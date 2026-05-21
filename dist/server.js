"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const http_1 = require("http");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const AdaptiveOrchestrator_1 = require("./core/AdaptiveOrchestrator");
const BrowserManager_1 = require("./core/BrowserManager");
const Logger_1 = require("./utils/Logger");
const logger = new Logger_1.Logger("UiServer");
const PORT = Number(process.env.UI_PORT || 3000);
const PUBLIC_DIR = (0, path_1.join)(process.cwd(), "public");
let isRunActive = false;
const recentLogs = [];
const sseClients = new Set();
Logger_1.Logger.subscribe((event) => {
    recentLogs.push(event);
    if (recentLogs.length > 500) {
        recentLogs.shift();
    }
    broadcastLog(event);
});
const mimeTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
};
const server = (0, http_1.createServer)(async (req, res) => {
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
    }
    catch (error) {
        logger.error("Request failed:", error);
        sendJson(res, 500, {
            error: error instanceof Error ? error.message : String(error),
        });
    }
});
server.listen(PORT, () => {
    logger.info(`UI ready at http://localhost:${PORT}`);
});
async function handleRun(req, res) {
    if (isRunActive) {
        sendJson(res, 409, {
            error: "A test run is already active. Wait until it finishes.",
        });
        return;
    }
    const body = await readJsonBody(req);
    const input = normalizeGoalInput(body);
    logger.info("UI requested adaptive test run", {
        goal: input.goal,
        url: input.url,
    });
    isRunActive = true;
    try {
        const runner = new AdaptiveOrchestrator_1.AdaptiveOrchestrator({
            maxActions: 30,
            maxRetriesPerAction: 3,
            stepDelayMs: 1000,
            screenshotOnFailure: true,
            verifyEveryActions: 3,
        });
        const result = await runner.run(input, `ui-${Date.now()}`);
        sendJson(res, 200, result);
    }
    finally {
        isRunActive = false;
        await BrowserManager_1.BrowserManager.getInstance().close();
    }
}
function handleEvents(req, res) {
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
async function serveStatic(req, res) {
    const requestedPath = decodeURIComponent((req.url || "/").split("?")[0]);
    const relativePath = requestedPath === "/" ? "index.html" : requestedPath.slice(1);
    const filePath = (0, path_1.join)(PUBLIC_DIR, relativePath);
    if (!filePath.startsWith(PUBLIC_DIR)) {
        sendJson(res, 403, { error: "Forbidden" });
        return;
    }
    try {
        const data = await (0, promises_1.readFile)(filePath);
        const contentType = mimeTypes[(0, path_1.extname)(filePath)] || "application/octet-stream";
        res.writeHead(200, { "Content-Type": contentType });
        res.end(data);
    }
    catch {
        sendJson(res, 404, { error: "Not found" });
    }
}
function normalizeGoalInput(input) {
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
        context: input.context?.trim() ||
            "Nutze die sichtbare UI und aktuelle URL. Wenn Zugangsdaten oder Testdaten benoetigt werden, entnimm sie direkt aus dem Zieltext.",
        testData: input.testData ?? {},
    };
}
function readJsonBody(req) {
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
                resolve(JSON.parse(raw || "{}"));
            }
            catch {
                reject(new Error("Request body must be valid JSON"));
            }
        });
        req.on("error", reject);
    });
}
function sendJson(res, statusCode, payload) {
    res.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
    });
    res.end(JSON.stringify(payload, null, 2));
}
function broadcastLog(event) {
    for (const client of sseClients) {
        sendSse(client, event);
    }
}
function sendSse(res, event) {
    res.write(`id: ${event.id}\n`);
    res.write("event: log\n");
    res.write(`data: ${JSON.stringify(event)}\n\n`);
}
