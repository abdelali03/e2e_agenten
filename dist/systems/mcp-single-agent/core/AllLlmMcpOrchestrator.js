"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllLlmMcpOrchestrator = void 0;
const AllLlmMcpAgent_1 = require("../agents/AllLlmMcpAgent");
const EnhancedMcpSnapshotTool_1 = require("../../../utils/EnhancedMcpSnapshotTool");
const PlaywrightMcpClient_1 = require("../../../utils/PlaywrightMcpClient");
const VisionTool_1 = require("../../../utils/VisionTool");
const Logger_1 = require("../../../utils/Logger");
const logger = new Logger_1.Logger("AllLlmMcpOrchestrator");
class AllLlmMcpOrchestrator {
    mcp;
    agent;
    enhancedSnapshotTool;
    visionTool;
    config;
    constructor(config = {}) {
        this.mcp = new PlaywrightMcpClient_1.PlaywrightMcpClient();
        this.agent = new AllLlmMcpAgent_1.AllLlmMcpAgent();
        this.enhancedSnapshotTool = new EnhancedMcpSnapshotTool_1.EnhancedMcpSnapshotTool();
        this.visionTool = new VisionTool_1.VisionTool();
        this.config = {
            maxToolCalls: config.maxToolCalls ?? 50,
            visionAfterConsecutiveFailures: config.visionAfterConsecutiveFailures ?? 2,
            visionAfterConsecutiveSnapshots: config.visionAfterConsecutiveSnapshots ?? 2,
        };
    }
    async run(input, sessionId = `all-llm-mcp-${Date.now()}`) {
        logger.info(`\n${"=".repeat(60)}`);
        logger.info(` All-LLM MCP session: ${sessionId}`);
        logger.info(` Goal: ${input.goal}`);
        logger.info(`${"=".repeat(60)}\n`);
        const history = [];
        let lastError;
        let consecutiveToolFailures = 0;
        let consecutiveSnapshots = 0;
        let visionRecoveryActive = false;
        let snapshotsAfterVision = 0;
        try {
            await this.mcp.connect();
            const tools = await this.mcp.listTools();
            logger.info("Playwright MCP tools available", {
                tools: tools.map((tool) => tool.name),
            });
            for (let index = 1; index <= this.config.maxToolCalls; index += 1) {
                lastError = this.getLoopHint(history, lastError);
                const decision = await this.agent
                    .decide({
                    goal: input,
                    tools,
                    observations: history,
                    actionMemory: this.buildActionMemory(input, history, lastError),
                    lastError,
                })
                    .catch((error) => {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    lastError = `LLM decision failed: ${errorMessage}`;
                    history.push({
                        index: this.nextHistoryIndex(history),
                        toolName: "llm_decision",
                        arguments: {},
                        success: false,
                        resultText: "The model failed to return a valid MCP tool decision. Try again with valid JSON and an existing tool name.",
                        errorMessage: lastError,
                    });
                    logger.warn(lastError);
                    return undefined;
                });
                if (!decision) {
                    continue;
                }
                if (decision.status === "complete") {
                    return this.finish("passed", input, history, decision.finalSummary);
                }
                if (decision.status === "blocked") {
                    return this.finish("blocked", input, history, decision.finalSummary, decision.reasoning);
                }
                logger.info(`\n-- All-LLM MCP tool ${index}/${this.config.maxToolCalls}: ${decision.toolName} --`, decision.arguments);
                if (decision.toolName === "browser_snapshot" &&
                    visionRecoveryActive &&
                    snapshotsAfterVision >= 1) {
                    lastError =
                        "A successful vision_analysis is already available and one fresh full-page snapshot was already taken. Choose an interaction tool now instead of repeating browser_snapshot.";
                    history.push({
                        index: this.nextHistoryIndex(history),
                        toolName: "llm_decision",
                        arguments: decision.arguments ?? {},
                        success: false,
                        resultText: "Rejected repeated snapshot after vision recovery. The agent must act using the latest vision_analysis, enhanced snapshot context, and MCP refs/selectors.",
                        errorMessage: lastError,
                    });
                    logger.warn("Rejected repeated snapshot after vision recovery", {
                        requestedArguments: decision.arguments,
                        lastError,
                    });
                    continue;
                }
                if (decision.toolName === "browser_snapshot" && visionRecoveryActive) {
                    decision.arguments = this.normalizePostVisionSnapshotArgs(decision.arguments ?? {});
                    logger.info("Vision recovery active; forcing one full-page snapshot for MCP refs", decision.arguments);
                }
                try {
                    const result = await this.callTool(decision.toolName, decision.arguments ?? {});
                    const errorMessage = result.isError ? result.text : undefined;
                    lastError = this.enrichErrorHint(errorMessage, history);
                    consecutiveToolFailures = result.isError ? consecutiveToolFailures + 1 : 0;
                    consecutiveSnapshots =
                        decision.toolName === "browser_snapshot" && !result.isError
                            ? consecutiveSnapshots + 1
                            : 0;
                    snapshotsAfterVision =
                        visionRecoveryActive && decision.toolName === "browser_snapshot" && !result.isError
                            ? snapshotsAfterVision + 1
                            : snapshotsAfterVision;
                    history.push({
                        index: this.nextHistoryIndex(history),
                        toolName: decision.toolName,
                        arguments: decision.arguments ?? {},
                        success: !result.isError,
                        resultText: result.text,
                        errorMessage: lastError,
                    });
                    if (consecutiveToolFailures >= this.config.visionAfterConsecutiveFailures) {
                        const visionAdded = await this.addVisionAnalysis(input, history, lastError, "consecutive_failures");
                        visionRecoveryActive = visionAdded;
                        snapshotsAfterVision = 0;
                        consecutiveToolFailures = 0;
                    }
                    if (consecutiveSnapshots >= this.config.visionAfterConsecutiveSnapshots) {
                        const visionAdded = await this.addVisionAnalysis(input, history, "The agent called browser_snapshot repeatedly without taking an action.", "consecutive_snapshots");
                        visionRecoveryActive = visionAdded;
                        snapshotsAfterVision = 0;
                        consecutiveSnapshots = 0;
                    }
                    if (decision.toolName !== "browser_snapshot" && !result.isError) {
                        visionRecoveryActive = false;
                        snapshotsAfterVision = 0;
                    }
                }
                catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    lastError = this.enrichErrorHint(errorMessage, history);
                    consecutiveToolFailures += 1;
                    consecutiveSnapshots = 0;
                    history.push({
                        index: this.nextHistoryIndex(history),
                        toolName: decision.toolName,
                        arguments: decision.arguments ?? {},
                        success: false,
                        resultText: "",
                        errorMessage: lastError,
                    });
                    if (consecutiveToolFailures >= this.config.visionAfterConsecutiveFailures) {
                        const visionAdded = await this.addVisionAnalysis(input, history, lastError, "consecutive_failures");
                        visionRecoveryActive = visionAdded;
                        snapshotsAfterVision = 0;
                        consecutiveToolFailures = 0;
                    }
                }
            }
            return this.finish("failed", input, history, undefined, `Maximum MCP tool calls (${this.config.maxToolCalls}) reached before completion.`);
        }
        finally {
            await this.mcp.close();
        }
    }
    async addVisionAnalysis(input, history, lastError, trigger) {
        const analysis = await this.visionTool.analyzeCurrentPage(this.mcp, {
            goal: input.goal,
            lastError,
            recentFailures: history
                .filter((entry) => !entry.success)
                .slice(-4)
                .map((entry) => [
                entry.toolName,
                entry.errorMessage || entry.resultText || "failed without details",
            ]
                .filter(Boolean)
                .join(": ")
                .slice(0, 1000)),
            recentObservations: history
                .slice(-4)
                .map((entry) => [
                entry.toolName,
                entry.success ? "success" : "failed",
                entry.errorMessage ? `error=${entry.errorMessage}` : "",
                entry.resultText ? `result=${entry.resultText.slice(0, 500)}` : "",
            ]
                .filter(Boolean)
                .join(" ")),
        });
        if (!analysis) {
            history.push({
                index: this.nextHistoryIndex(history),
                toolName: "vision_analysis",
                arguments: { trigger },
                success: false,
                resultText: "",
                errorMessage: "Vision analysis was triggered after repeated failures, but no analysis could be produced.",
            });
            return false;
        }
        history.push({
            index: this.nextHistoryIndex(history),
            toolName: "vision_analysis",
            arguments: { trigger },
            success: true,
            resultText: JSON.stringify(analysis),
        });
        return true;
    }
    normalizePostVisionSnapshotArgs(args) {
        const { target: _target, ...rest } = args;
        return {
            ...rest,
            boxes: true,
            depth: typeof args.depth === "number"
                ? Math.max(args.depth, 20)
                : 20,
        };
    }
    buildActionMemory(input, history, lastError) {
        const successfulActions = history
            .filter((entry) => entry.success &&
            !["browser_snapshot", "vision_analysis", "llm_decision"].includes(entry.toolName))
            .slice(-12)
            .map((entry) => ({
            index: entry.index,
            toolName: entry.toolName,
            arguments: this.compactArguments(entry.arguments),
        }));
        const latestVision = [...history]
            .reverse()
            .find((entry) => entry.toolName === "vision_analysis" && entry.success);
        const parsedVision = latestVision
            ? this.parseVisionMemory(latestVision.resultText)
            : undefined;
        const rejectedSnapshots = history
            .filter((entry) => entry.toolName === "llm_decision" &&
            entry.errorMessage?.includes("vision_analysis is already available"))
            .slice(-3).length;
        return JSON.stringify({
            goal: input.goal,
            successfulActions,
            latestVisionGoalProgress: parsedVision?.goalProgress,
            latestVisionCompletionEstimate: parsedVision?.goalCompletionEstimate,
            latestVisionConfidence: parsedVision?.confidence,
            latestVisionRecommendedNextAction: parsedVision?.recommendedNextAction,
            snapshotLoopGuard: {
                rejectedSnapshotsAfterVision: rejectedSnapshots,
                rule: "After vision recovery and one full-page snapshot, choose an interaction tool instead of another snapshot.",
            },
            lastError,
            memoryRules: [
                "Successful previous actions remain completed unless a later observation clearly contradicts them.",
                "Low-confidence or partial vision analysis must not erase successful action history.",
                "When a dialog/overlay blocks background clicks, continue inside the dialog/overlay instead of closing it by default.",
            ],
        }, null, 2).slice(0, 8000);
    }
    compactArguments(args) {
        const input = args ?? {};
        const compact = {};
        for (const [key, value] of Object.entries(input)) {
            if (typeof value === "string") {
                compact[key] = value.length > 300 ? `${value.slice(0, 300)}...` : value;
            }
            else {
                compact[key] = value;
            }
        }
        return compact;
    }
    parseVisionMemory(raw) {
        try {
            const parsed = JSON.parse(raw);
            return {
                confidence: parsed.confidence,
                goalProgress: parsed.goalProgress,
                goalCompletionEstimate: parsed.goalCompletionEstimate,
                recommendedNextAction: parsed.recommendedNextAction,
            };
        }
        catch {
            return undefined;
        }
    }
    enrichErrorHint(errorMessage, history) {
        if (!errorMessage) {
            return undefined;
        }
        const hasSuccessfulFormProgress = history.some((entry) => entry.success &&
            ["browser_type", "browser_fill_form", "browser_select_option"].includes(entry.toolName));
        if (/intercept|overlay|modal|dialog|backdrop|pointer events/i.test(errorMessage)) {
            return [
                errorMessage,
                "Recovery hint: a dialog/overlay appears to block the requested action. Do not click behind it. Prefer interacting with the visible dialog/overlay fields/buttons, or request one full-page snapshot to locate them. Avoid Escape/Back if a partially completed form may be open.",
                hasSuccessfulFormProgress
                    ? "Important: previous form input actions succeeded, so preserve that progress unless a later observation proves it was lost."
                    : "",
            ]
                .filter(Boolean)
                .join("\n");
        }
        return errorMessage;
    }
    async callTool(toolName, args) {
        if (toolName === "browser_snapshot") {
            return await this.enhancedSnapshotTool.capture(this.mcp, args);
        }
        return await this.mcp.callTool(toolName, args);
    }
    nextHistoryIndex(history) {
        return history.length + 1;
    }
    getLoopHint(history, lastError) {
        const recent = history.slice(-3);
        if (recent.length === 3 &&
            recent.every((entry) => entry.toolName === "browser_snapshot" && entry.success)) {
            return [
                lastError,
                "You called browser_snapshot repeatedly. The latest snapshot is available. Choose an interaction tool now, such as browser_click, browser_fill_form, browser_type, browser_press_key, browser_select_option, or browser_wait_for.",
            ]
                .filter(Boolean)
                .join("\n");
        }
        return lastError;
    }
    finish(status, input, history, finalSummary, errorMessage) {
        const result = {
            status,
            goal: input.goal,
            history,
            finalSummary,
            errorMessage,
        };
        console.log(this.getSummary(result));
        return result;
    }
    getSummary(result) {
        const succeeded = result.history.filter((entry) => entry.success).length;
        return [
            `\n${"=".repeat(50)}`,
            ` ALL-LLM MCP TEST SUMMARY`,
            `${"=".repeat(50)}`,
            ` Goal:   ${result.goal}`,
            ` Status: ${result.status.toUpperCase()}`,
            ` Tools:  ${succeeded}/${result.history.length} calls succeeded`,
            result.finalSummary ? ` Summary: ${result.finalSummary}` : "",
            result.errorMessage ? ` Error:  ${result.errorMessage}` : "",
            `${"=".repeat(50)}`,
            ...result.history.map((entry) => {
                const icon = entry.success ? "OK" : "FAIL";
                const error = entry.errorMessage ? ` -> ${entry.errorMessage}` : "";
                return ` ${icon} ${entry.index}. ${entry.toolName}${error}`;
            }),
            `${"=".repeat(50)}\n`,
        ]
            .filter((line) => line.length > 0)
            .join("\n");
    }
}
exports.AllLlmMcpOrchestrator = AllLlmMcpOrchestrator;
