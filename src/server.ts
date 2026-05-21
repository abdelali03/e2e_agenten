import dotenv from "dotenv";
dotenv.config();

import { createServer, IncomingMessage, ServerResponse } from "http";
import { readFile } from "fs/promises";
import { extname, join } from "path";
import { AdaptiveOrchestrator } from "./systems/deterministic-playwright/core/AdaptiveOrchestrator";
import { AllLlmOrchestrator } from "./systems/llm-command/core/AllLlmOrchestrator";
import { AllLlmMcpOrchestrator } from "./systems/mcp-single-agent/core/AllLlmMcpOrchestrator";
import { McpMultiAgentOrchestrator } from "./systems/mcp-multi-agent/core/McpMultiAgentOrchestrator";
import { BrowserManager } from "./systems/deterministic-playwright/core/BrowserManager";
import { Logger, LogEvent } from "./utils/Logger";
import type { GoalInput } from "./core/types";

const logger = new Logger("UiServer");
const PORT = Number(process.env.UI_PORT || 3000);
const PUBLIC_DIR = join(process.cwd(), "public");

type AgentMode =
  | "adaptive"
  | "all-llm"
  | "all-llm-mcp"
  | "mcp-multi-agent";

interface RunRequest extends GoalInput {
  mode?: AgentMode;
}

let isRunActive = false;
const recentLogs: LogEvent[] = [];
const sseClients = new Set<ServerResponse>();

Logger.subscribe((event) => {
  recentLogs.push(event);

  if (recentLogs.length > 500) {
    recentLogs.shift();
  }

  broadcastLog(event);
});

const mimeTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

const server = createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/api/run") {
      await handleRun(req, res);
      return;
    }

    if (req.method === "GET" && req.url === "/api/events") {
      handleEvents(req, res);
      return;
    }

    if (req.method === "GET") {
      await serveStatic(req, res);
      return;
    }

    sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    logger.error("Request failed:", error);
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

startServer(PORT);

async function handleRun(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (isRunActive) {
    sendJson(res, 409, {
      error: "A test run is already active. Wait until it finishes.",
    });
    return;
  }

  const body = await readJsonBody<RunRequest>(req);
  const input = normalizeGoalInput(body);
  const mode = normalizeAgentMode(body.mode || process.env.AGENT_MODE);

  logger.info("UI requested test run", {
    mode,
    goal: input.goal,
    url: input.url,
  });

  isRunActive = true;

  try {
    const result =
      mode === "mcp-multi-agent"
        ? await new McpMultiAgentOrchestrator({
            maxToolCalls: 70,
            recursionLimit: 180,
          }).run(input, `ui-mcp-multi-agent-${Date.now()}`)
        : mode === "all-llm-mcp"
        ? await new AllLlmMcpOrchestrator({
            maxToolCalls: 50,
          }).run(input, `ui-all-llm-mcp-${Date.now()}`)
        : mode === "all-llm"
        ? await new AllLlmOrchestrator({
            maxActions: 40,
            stepDelayMs: 1000,
            verifyEveryActions: 4,
          }).run(input, `ui-all-llm-${Date.now()}`)
        : await new AdaptiveOrchestrator({
            maxActions: 30,
            maxRetriesPerAction: 3,
            stepDelayMs: 1000,
            screenshotOnFailure: true,
            verifyEveryActions: 3,
          }).run(input, `ui-${Date.now()}`);

    sendJson(res, 200, result);
  } finally {
    isRunActive = false;
    if (mode !== "all-llm-mcp" && mode !== "mcp-multi-agent") {
      await BrowserManager.getInstance().close();
    }
  }
}

function handleEvents(req: IncomingMessage, res: ServerResponse): void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  res.write(": connected\n\n");
  sseClients.add(res);

  for (const event of recentLogs.slice(-100)) {
    sendSse(res, event);
  }

  req.on("close", () => {
    sseClients.delete(res);
  });
}

async function serveStatic(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const requestedPath = decodeURIComponent((req.url || "/").split("?")[0]);
  const relativePath = requestedPath === "/" ? "index.html" : requestedPath.slice(1);
  const filePath = join(PUBLIC_DIR, relativePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  try {
    const data = await readFile(filePath);
    const contentType = mimeTypes[extname(filePath)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  } catch {
    sendJson(res, 404, { error: "Not found" });
  }
}

function normalizeGoalInput(input: GoalInput): GoalInput {
  if (!input || typeof input !== "object") {
    throw new Error("Request body must be a goal input object");
  }

  if (!input.goal?.trim()) {
    throw new Error("Goal is required");
  }

  if (!input.url?.trim()) {
    throw new Error("Start URL is required");
  }

  return {
    ...input,
    goal: input.goal.trim(),
    url: input.url.trim(),
    context:
      input.context?.trim() ||
      "Nutze die sichtbare UI und aktuelle URL. Wenn Zugangsdaten oder Testdaten benoetigt werden, entnimm sie direkt aus dem Zieltext.",
    testData: input.testData ?? {},
  };
}

function normalizeAgentMode(mode: string | undefined): AgentMode {
  const normalized = (mode || "adaptive").toLowerCase();

  if (
    normalized === "adaptive" ||
    normalized === "all-llm" ||
    normalized === "all-llm-mcp" ||
    normalized === "mcp-multi-agent"
  ) {
    return normalized;
  }

  throw new Error(
    `Unknown agent mode "${mode}". Use adaptive, all-llm, all-llm-mcp, or mcp-multi-agent.`
  );
}

function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let raw = "";

    req.on("data", (chunk) => {
      raw += chunk;

      if (raw.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });

    req.on("end", () => {
      try {
        resolve(JSON.parse(raw || "{}") as T);
      } catch {
        reject(new Error("Request body must be valid JSON"));
      }
    });

    req.on("error", reject);
  });
}

function sendJson(
  res: ServerResponse,
  statusCode: number,
  payload: unknown
): void {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(payload, null, 2));
}

function broadcastLog(event: LogEvent): void {
  for (const client of sseClients) {
    sendSse(client, event);
  }
}

function sendSse(res: ServerResponse, event: LogEvent): void {
  res.write(`id: ${event.id}\n`);
  res.write("event: log\n");
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function startServer(port: number, attemptsLeft = 10): void {
  let currentPort = port;
  let remainingAttempts = attemptsLeft;

  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE" && remainingAttempts > 1) {
      const nextPort = currentPort + 1;
      logger.warn(
        `UI port ${currentPort} is already in use. Trying http://localhost:${nextPort}`
      );
      currentPort = nextPort;
      remainingAttempts -= 1;
      server.listen(currentPort);
      return;
    }

    logger.error("UI server failed to start:", error);
    process.exit(1);
  });

  server.on("listening", () => {
    const address = server.address();
    const actualPort =
      typeof address === "object" && address !== null ? address.port : currentPort;
    logger.info(`UI ready at http://localhost:${actualPort}`);
  });

server.listen(currentPort);
}
