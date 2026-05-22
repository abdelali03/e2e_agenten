"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VisionClient = void 0;
const child_process_1 = require("child_process");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const util_1 = require("util");
const Logger_1 = require("./Logger");
const LlmClient_1 = require("./LlmClient");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
const logger = new Logger_1.Logger("VisionClient");
class VisionClient {
    llm = new LlmClient_1.LlmClient();
    async analyzeUiRecovery(input) {
        const prompt = this.buildRecoveryVisionPrompt(input);
        const raw = await this.describeScreenshot({
            screenshotBase64: input.screenshotBase64,
            prompt,
        });
        if (!raw) {
            return undefined;
        }
        const analysis = await this.structureVisualRecoveryAnalysis(input, raw);
        if (!analysis) {
            logger.warn("Could not parse structured visual recovery analysis. Using text fallback.");
            return {
                pageSummary: raw.slice(0, 1200),
                targetVisible: false,
                targetState: {},
                blockingUi: {
                    hasDialog: false,
                    hasMenu: false,
                    hasOverlay: false,
                },
                mismatch: "MiniMax vision returned unstructured output.",
                recommendedNextAction: "Use the visual description to choose the next safe browser action.",
                confidence: "low",
            };
        }
        return analysis;
    }
    async describeScreenshot(input) {
        if (process.env.MINIMAX_VISION_ENABLED !== "true") {
            logger.debug("Vision is disabled. Set MINIMAX_VISION_ENABLED=true to enable it.");
            return undefined;
        }
        const mode = process.env.MINIMAX_VISION_MODE || "cli";
        if (mode !== "cli") {
            logger.warn(`Unsupported MINIMAX_VISION_MODE="${mode}". Only "cli" is implemented.`);
            return undefined;
        }
        return await this.describeWithCli(input);
    }
    async describeWithCli(input) {
        const command = process.env.MINIMAX_VISION_COMMAND || "mmx";
        const filePath = (0, path_1.join)(process.env.TEMP || process.env.TMP || "C:\\tmp", `ai-test-agent-screenshot-${Date.now()}.png`);
        await (0, promises_1.writeFile)(filePath, Buffer.from(input.screenshotBase64, "base64"));
        try {
            logger.info("Requesting screenshot understanding from MiniMax vision CLI");
            const args = this.buildCliArgs(filePath, input.prompt);
            const executable = command.endsWith(".cmd") ? "cmd.exe" : command;
            const executableArgs = command.endsWith(".cmd")
                ? ["/c", command, ...args]
                : args;
            const { stdout, stderr } = await execFileAsync(executable, executableArgs, {
                timeout: 60_000,
                maxBuffer: 2_000_000,
            });
            const output = `${stdout}\n${stderr}`.trim();
            if (!output) {
                logger.warn("MiniMax vision CLI returned empty output.");
                return undefined;
            }
            const content = this.extractCliContent(output).slice(0, 5000);
            this.logVisionResult("MiniMax vision CLI returned analysis", {
                imagePath: filePath,
                content,
            });
            return content;
        }
        catch (error) {
            logger.warn("MiniMax vision CLI failed:", error instanceof Error ? error.message : String(error));
            return undefined;
        }
        finally {
            await (0, promises_1.unlink)(filePath).catch(() => undefined);
        }
    }
    buildCliArgs(filePath, prompt) {
        const apiKeyArgs = process.env.MINIMAX_API_KEY
            ? ["--api-key", process.env.MINIMAX_API_KEY]
            : [];
        const template = process.env.MINIMAX_VISION_ARGS;
        if (template) {
            return [...apiKeyArgs, ...this.expandArgsTemplate(template, filePath, prompt)];
        }
        return [
            ...apiKeyArgs,
            "vision",
            "describe",
            "--image",
            filePath,
            "--prompt",
            prompt,
        ];
    }
    expandArgsTemplate(template, filePath, prompt) {
        const promptToken = "__PROMPT_PLACEHOLDER__";
        const fileToken = "__FILE_PLACEHOLDER__";
        const expanded = template
            .replaceAll("{file}", fileToken)
            .replaceAll("{prompt}", promptToken);
        return expanded
            .split(" ")
            .filter(Boolean)
            .map((part) => {
            if (part === fileToken)
                return filePath;
            if (part === promptToken)
                return prompt;
            return part;
        });
    }
    buildRecoveryVisionPrompt(input) {
        return [
            "You are a UI automation recovery vision analyst.",
            "Describe the screenshot in plain text for browser automation recovery.",
            "Do not return coordinates, point arrays, bounding boxes, annotations, JSON, markdown, or code fences.",
            "",
            "Original goal:",
            input.goal,
            "",
            "Current failed instruction:",
            input.instruction,
            "",
            "Expected outcome:",
            input.expectedOutcome || "Not specified",
            "",
            "Error:",
            input.errorMessage,
            "",
            "Analyze the screenshot for browser automation recovery.",
            "Focus on complex UI components, not general aesthetics.",
            "Compare what should have happened with what is visibly true.",
            "",
            "Include:",
            "- current page or dialog summary",
            "- visible value/placeholder of the relevant target field",
            "- whether the target appears empty, filled, disabled, focused, invalid, or blocked",
            "- visible menus, dialogs, overlays, toasts, validation errors",
            "- what mismatch exists between expected outcome and screenshot",
            "- one safe next browser action",
            "Be concise and concrete.",
        ].join("\n");
    }
    async structureVisualRecoveryAnalysis(input, visualDescription) {
        try {
            const response = await this.llm.complete([
                {
                    role: "system",
                    content: "You convert visual UI recovery descriptions into strict JSON for a browser automation agent. Return only valid JSON.",
                },
                {
                    role: "user",
                    content: [
                        "Original goal:",
                        input.goal,
                        "",
                        "Failed instruction:",
                        input.instruction,
                        "",
                        "Expected outcome:",
                        input.expectedOutcome || "Not specified",
                        "",
                        "Error:",
                        input.errorMessage,
                        "",
                        "Vision description:",
                        visualDescription,
                        "",
                        "Return exactly this JSON shape:",
                        "{",
                        '  "pageSummary": "short concrete description of the current UI",',
                        '  "targetVisible": true,',
                        '  "targetState": {',
                        '    "visibleValue": "what the relevant field visibly shows, e.g. hh:mm or 09:00",',
                        '    "placeholder": "visible placeholder if any",',
                        '    "disabled": false,',
                        '    "focused": false,',
                        '    "errorState": false,',
                        '    "empty": false',
                        "  },",
                        '  "blockingUi": {',
                        '    "hasDialog": false,',
                        '    "hasMenu": false,',
                        '    "hasOverlay": false,',
                        '    "description": "visible blocking UI if any"',
                        "  },",
                        '  "mismatch": "what the executor/planner believed vs what the screenshot shows",',
                        '  "recommendedNextAction": "one safe next browser action in natural language",',
                        '  "confidence": "low|medium|high"',
                        "}",
                    ].join("\n"),
                },
            ], 2048);
            const parsed = LlmClient_1.LlmClient.parseJsonResponse(response.content);
            this.validateAnalysis(parsed);
            return parsed;
        }
        catch (error) {
            logger.warn("Could not structure visual recovery analysis:", error instanceof Error ? error.message : String(error));
            return undefined;
        }
    }
    extractCliContent(raw) {
        try {
            const parsed = LlmClient_1.LlmClient.parseJsonResponse(raw);
            if (parsed.content) {
                return parsed.content;
            }
        }
        catch {
            // Some CLI modes may return plain text.
        }
        return raw;
    }
    logVisionResult(message, meta) {
        const baseMeta = {
            contentLength: meta.content.length,
            contentPreview: meta.content.slice(0, process.env.VISION_LOG_RESULT === "true" ? 2500 : 500),
        };
        if (process.env.VISION_LOG_RESULT !== "true") {
            logger.info(`${message} (preview truncated; set VISION_LOG_RESULT=true for more)`, baseMeta);
            return;
        }
        logger.info(message, {
            imagePath: meta.imagePath,
            ...baseMeta,
        });
    }
    parseVisualRecoveryAnalysis(raw) {
        try {
            const parsed = LlmClient_1.LlmClient.parseJsonResponse(raw);
            this.validateAnalysis(parsed);
            return parsed;
        }
        catch {
            return undefined;
        }
    }
    validateAnalysis(analysis) {
        if (!analysis || typeof analysis !== "object") {
            throw new Error("Invalid visual analysis");
        }
        if (!analysis.pageSummary || !analysis.mismatch || !analysis.recommendedNextAction) {
            throw new Error("Visual analysis missing required text fields");
        }
        if (!["low", "medium", "high"].includes(analysis.confidence)) {
            throw new Error("Visual analysis has invalid confidence");
        }
    }
}
exports.VisionClient = VisionClient;
