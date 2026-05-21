"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlaywrightMcpClient = void 0;
const path_1 = require("path");
const index_js_1 = require("@modelcontextprotocol/sdk/client/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/client/stdio.js");
const Logger_1 = require("./Logger");
const logger = new Logger_1.Logger("PlaywrightMcpClient");
class PlaywrightMcpClient {
    client = null;
    transport = null;
    async connect() {
        if (this.client) {
            return;
        }
        const cliPath = (0, path_1.join)(process.cwd(), "node_modules", "@playwright", "mcp", "cli.js");
        const args = [
            cliPath,
            "--viewport-size",
            process.env.PLAYWRIGHT_MCP_VIEWPORT || "1280x720",
            "--timeout-action",
            process.env.PLAYWRIGHT_MCP_ACTION_TIMEOUT || "15000",
            "--timeout-navigation",
            process.env.PLAYWRIGHT_MCP_NAVIGATION_TIMEOUT || "30000",
            "--isolated",
        ];
        if (process.env.PLAYWRIGHT_MCP_BROWSER) {
            args.push("--browser", process.env.PLAYWRIGHT_MCP_BROWSER);
        }
        if (process.env.HEADLESS === "true") {
            args.push("--headless");
        }
        if (process.env.PLAYWRIGHT_MCP_CAPS) {
            args.push("--caps", process.env.PLAYWRIGHT_MCP_CAPS);
        }
        logger.info("Starting Playwright MCP server", {
            command: process.execPath,
            args,
        });
        this.transport = new stdio_js_1.StdioClientTransport({
            command: process.execPath,
            args,
            cwd: process.cwd(),
            stderr: "pipe",
        });
        this.transport.stderr?.on("data", (chunk) => {
            logger.debug(`Playwright MCP stderr: ${String(chunk)}`);
        });
        this.client = new index_js_1.Client({
            name: "ai-test-agent-all-llm-mcp",
            version: "0.1.0",
        });
        await this.client.connect(this.transport);
        logger.info("Connected to Playwright MCP server", {
            server: this.client.getServerVersion(),
            capabilities: this.client.getServerCapabilities(),
        });
    }
    async listTools() {
        const client = this.requiredClient();
        const result = await client.listTools();
        return result.tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
        }));
    }
    async callTool(name, args = {}) {
        const client = this.requiredClient();
        const result = await client.callTool({
            name,
            arguments: args,
        });
        return {
            text: this.resultToText(result),
            raw: result,
            isError: "isError" in result && typeof result.isError === "boolean"
                ? result.isError
                : undefined,
        };
    }
    async close() {
        await this.transport?.close().catch((error) => {
            logger.warn("Could not close Playwright MCP transport:", error instanceof Error ? error.message : String(error));
        });
        this.transport = null;
        this.client = null;
    }
    requiredClient() {
        if (!this.client) {
            throw new Error("PlaywrightMcpClient is not connected");
        }
        return this.client;
    }
    resultToText(result) {
        const maybeResult = result;
        if (Array.isArray(maybeResult.content)) {
            return maybeResult.content
                .map((part) => {
                if (part.type === "text") {
                    return part.text;
                }
                if (part.type === "image") {
                    const data = typeof part.data === "string" ? part.data : "";
                    const mimeType = typeof part.mimeType === "string" ? part.mimeType : "unknown";
                    return `[image ${mimeType}, base64 length=${data.length}]`;
                }
                return JSON.stringify(part);
            })
                .join("\n")
                .slice(0, 30_000);
        }
        if (maybeResult.structuredContent) {
            return JSON.stringify(maybeResult.structuredContent, null, 2).slice(0, 30_000);
        }
        if (maybeResult.toolResult) {
            return JSON.stringify(maybeResult.toolResult, null, 2).slice(0, 30_000);
        }
        return JSON.stringify(result, null, 2).slice(0, 30_000);
    }
}
exports.PlaywrightMcpClient = PlaywrightMcpClient;
