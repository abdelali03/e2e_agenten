"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdaptiveOrchestrator = void 0;
const BrowserManager_1 = require("./BrowserManager");
const AdaptivePlannerAgent_1 = require("../agents/AdaptivePlannerAgent");
const DomAnalystAgent_1 = require("../agents/DomAnalystAgent");
const ExecutorAgent_1 = require("../agents/ExecutorAgent");
const CriticAgent_1 = require("../agents/CriticAgent");
const GoalVerifierAgent_1 = require("../agents/GoalVerifierAgent");
const AomExtractor_1 = require("../utils/AomExtractor");
const Logger_1 = require("../utils/Logger");
const VisionClient_1 = require("../utils/VisionClient");
const logger = new Logger_1.Logger("AdaptiveOrchestrator");
class AdaptiveOrchestrator {
    browser;
    planner;
    analyst;
    critic;
    verifier;
    vision;
    config;
    constructor(config = {}) {
        this.browser = BrowserManager_1.BrowserManager.getInstance();
        this.planner = new AdaptivePlannerAgent_1.AdaptivePlannerAgent();
        this.analyst = new DomAnalystAgent_1.DomAnalystAgent();
        this.critic = new CriticAgent_1.CriticAgent();
        this.verifier = new GoalVerifierAgent_1.GoalVerifierAgent();
        this.vision = new VisionClient_1.VisionClient();
        this.config = {
            maxActions: config.maxActions ?? 30,
            maxRetriesPerAction: config.maxRetriesPerAction ?? 3,
            stepDelayMs: config.stepDelayMs ?? 800,
            screenshotOnFailure: config.screenshotOnFailure ?? true,
            verifyEveryActions: config.verifyEveryActions ?? 3,
        };
    }
    async run(input, sessionId = `adaptive-${Date.now()}`) {
        logger.info(`\n${"=".repeat(60)}`);
        logger.info(` Adaptive session: ${sessionId}`);
        logger.info(` Goal: ${input.goal}`);
        logger.info(`${"=".repeat(60)}\n`);
        await this.browser.initialize();
        await this.browser.navigateTo(input.url);
        const executor = new ExecutorAgent_1.ExecutorAgent(this.browser.page);
        const history = [];
        let lastError;
        let repeatedInstructionCount = 0;
        for (let actionIndex = 1; actionIndex <= this.config.maxActions; actionIndex += 1) {
            const snapshot = await (0, AomExtractor_1.extractAomSnapshot)(this.browser.page);
            if (this.shouldVerify(actionIndex, history)) {
                const verification = await this.safeVerify(input, history);
                if (verification?.isComplete && verification.confidence !== "low") {
                    return this.finish("passed", input, history, verification);
                }
            }
            const next = await this.planner.nextAction({
                goal: input,
                snapshot,
                history,
                lastError,
            });
            if (next.status === "complete") {
                const verification = await this.safeVerify(input, history);
                if (verification?.isComplete && verification.confidence !== "low") {
                    return this.finish("passed", input, history, verification);
                }
                lastError =
                    "Planner considered goal complete, but verifier did not find enough evidence.";
                logger.warn(lastError, verification);
                continue;
            }
            if (next.status === "blocked") {
                const verification = await this.safeVerify(input, history);
                return this.finish("blocked", input, history, verification, next.reasoning);
            }
            const instruction = next.instruction.trim();
            repeatedInstructionCount = this.updateRepeatCount(history, instruction, repeatedInstructionCount);
            if (repeatedInstructionCount > this.config.maxRetriesPerAction) {
                return this.finish("failed", input, history, undefined, `Planner repeated the same instruction too often: "${instruction}"`);
            }
            logger.info(`\n-- Adaptive action ${actionIndex}/${this.config.maxActions}: "${instruction}" --`);
            const result = await this.executeWithRecovery(executor, input, instruction, next.expectedOutcome, history);
            const observedAfter = await this.captureObservedAfter().catch((error) => {
                logger.warn("Could not capture post-action observation:", error instanceof Error ? error.message : String(error));
                return undefined;
            });
            history.push({
                index: history.length + 1,
                instruction,
                expectedOutcome: next.expectedOutcome,
                success: result.success,
                errorMessage: result.errorMessage,
                actionPerformed: result.actionPerformed,
                urlAfter: this.browser.page.url(),
                observedAfter,
            });
            if (!result.success) {
                lastError = result.errorMessage ?? "Unknown action failure";
            }
            else {
                lastError = undefined;
            }
            if (this.config.stepDelayMs > 0) {
                await this.sleep(this.config.stepDelayMs);
            }
        }
        const verification = await this.safeVerify(input, history);
        if (verification?.isComplete && verification.confidence !== "low") {
            return this.finish("passed", input, history, verification);
        }
        return this.finish("failed", input, history, verification, `Maximum adaptive actions (${this.config.maxActions}) reached before goal completion.`);
    }
    async executeWithRecovery(executor, input, instruction, expectedOutcome, history) {
        let currentInstruction = instruction;
        let previousError;
        let visualContext;
        for (let attempt = 0; attempt <= this.config.maxRetriesPerAction; attempt += 1) {
            const result = await this.analyzeAndExecute(executor, currentInstruction, previousError, visualContext);
            if (result.success) {
                return result;
            }
            previousError = result.errorMessage ?? "Unknown error";
            if (this.config.screenshotOnFailure) {
                await this.tryCaptureScreenshot();
            }
            if (attempt >= 1 && !visualContext) {
                visualContext = await this.captureVisualContext(input, currentInstruction, previousError, expectedOutcome);
            }
            if (attempt >= this.config.maxRetriesPerAction) {
                return result;
            }
            const failureSnapshot = await (0, AomExtractor_1.extractAomSnapshot)(this.browser.page);
            try {
                const criticDecision = await this.critic.evaluate({
                    failedInstruction: currentInstruction,
                    errorMessage: previousError,
                    aomTreeAfterFailure: failureSnapshot,
                    retryCount: attempt,
                    visualContext,
                });
                if (criticDecision.abort || !criticDecision.shouldRetry) {
                    return result;
                }
                currentInstruction =
                    criticDecision.revisedInstruction?.trim() || currentInstruction;
                logger.info(`Retrying revised instruction: "${currentInstruction}"`);
                await this.sleep(1000);
            }
            catch (criticError) {
                const criticMessage = criticError instanceof Error ? criticError.message : String(criticError);
                return {
                    success: false,
                    actionPerformed: `Recovery for "${instruction}"`,
                    errorMessage: `Critic failed: ${criticMessage}. Original error: ${previousError}`,
                    durationMs: result.durationMs,
                };
            }
        }
        return {
            success: false,
            actionPerformed: `Execute "${instruction}"`,
            errorMessage: `Action did not succeed. Expected outcome: ${expectedOutcome ?? "not specified"}`,
            durationMs: 0,
        };
    }
    async analyzeAndExecute(executor, instruction, previousError, visualContext) {
        const start = Date.now();
        try {
            const snapshot = await (0, AomExtractor_1.extractAomSnapshot)(this.browser.page);
            const decision = await this.analyst.analyze({
                instruction,
                aomTree: snapshot,
                previousError,
                visualContext,
            });
            return await executor.execute(decision);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                success: false,
                actionPerformed: `Analyze/execute "${instruction}"`,
                errorMessage,
                durationMs: Date.now() - start,
            };
        }
    }
    async captureObservedAfter() {
        const snapshot = await (0, AomExtractor_1.extractAomSnapshot)(this.browser.page);
        return [
            `URL: ${snapshot.url}`,
            `Title: ${snapshot.title}`,
            `Visible text: ${snapshot.visibleText.slice(0, 1200)}`,
        ].join("\n");
    }
    async captureVisualContext(input, instruction, errorMessage, expectedOutcome) {
        try {
            const screenshotBase64 = await this.browser.takeScreenshot();
            const analysis = await this.vision.analyzeUiRecovery({
                screenshotBase64,
                goal: input.goal,
                instruction,
                expectedOutcome,
                errorMessage,
            });
            if (analysis) {
                logger.info("Visual recovery analysis captured", analysis);
            }
            return analysis ? JSON.stringify(analysis, null, 2) : undefined;
        }
        catch (error) {
            logger.warn("Could not capture visual recovery context:", error instanceof Error ? error.message : String(error));
            return undefined;
        }
    }
    async safeVerify(input, history) {
        try {
            const snapshot = await (0, AomExtractor_1.extractAomSnapshot)(this.browser.page);
            return await this.verifier.verify({
                goal: input,
                snapshot,
                history,
            });
        }
        catch (error) {
            logger.warn("Goal verification failed:", error instanceof Error ? error.message : String(error));
            return undefined;
        }
    }
    shouldVerify(actionIndex, history) {
        if (history.length === 0) {
            return false;
        }
        const lastActionSucceeded = history[history.length - 1]?.success === true;
        return (lastActionSucceeded &&
            (actionIndex % this.config.verifyEveryActions === 0 ||
                /submit|create|erstellen|speichern|save|confirm/i.test(history[history.length - 1].instruction)));
    }
    updateRepeatCount(history, instruction, currentCount) {
        const previous = history[history.length - 1]?.instruction;
        if (previous && previous.toLowerCase() === instruction.toLowerCase()) {
            return currentCount + 1;
        }
        return 1;
    }
    async tryCaptureScreenshot() {
        try {
            await this.browser.takeScreenshot();
            logger.debug("Screenshot captured for failed adaptive action.");
        }
        catch (error) {
            logger.warn("Could not capture screenshot:", error instanceof Error ? error.message : String(error));
        }
    }
    finish(status, input, history, verification, errorMessage) {
        const result = {
            status,
            goal: input.goal,
            history,
            verification,
            errorMessage,
        };
        console.log(this.getSummary(result));
        return result;
    }
    getSummary(result) {
        const succeeded = result.history.filter((entry) => entry.success).length;
        return [
            `\n${"=".repeat(50)}`,
            ` ADAPTIVE TEST SUMMARY`,
            `${"=".repeat(50)}`,
            ` Goal:   ${result.goal}`,
            ` Status: ${result.status.toUpperCase()}`,
            ` Steps:  ${succeeded}/${result.history.length} actions succeeded`,
            result.verification
                ? ` Verify: complete=${result.verification.isComplete}, confidence=${result.verification.confidence}`
                : ` Verify: not available`,
            result.errorMessage ? ` Error:  ${result.errorMessage}` : "",
            `${"=".repeat(50)}`,
            ...result.history.map((entry) => {
                const icon = entry.success ? "OK" : "FAIL";
                const error = entry.errorMessage ? ` -> ${entry.errorMessage}` : "";
                return ` ${icon} ${entry.index}. ${entry.instruction}${error}`;
            }),
            `${"=".repeat(50)}\n`,
        ]
            .filter((line) => line.length > 0)
            .join("\n");
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
exports.AdaptiveOrchestrator = AdaptiveOrchestrator;
