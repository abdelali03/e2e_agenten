"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllLlmOrchestrator = void 0;
const AllLlmAgent_1 = require("../agents/AllLlmAgent");
const LlmCommandExecutorAgent_1 = require("../agents/LlmCommandExecutorAgent");
const GoalVerifierAgent_1 = require("../../deterministic-playwright/agents/GoalVerifierAgent");
const BrowserManager_1 = require("../../deterministic-playwright/core/BrowserManager");
const AomExtractor_1 = require("../../../utils/AomExtractor");
const Logger_1 = require("../../../utils/Logger");
const logger = new Logger_1.Logger("AllLlmOrchestrator");
class AllLlmOrchestrator {
    browser = BrowserManager_1.BrowserManager.getInstance();
    agent = new AllLlmAgent_1.AllLlmAgent();
    verifier = new GoalVerifierAgent_1.GoalVerifierAgent();
    config;
    constructor(config = {}) {
        this.config = {
            maxActions: config.maxActions ?? 40,
            stepDelayMs: config.stepDelayMs ?? 800,
            verifyEveryActions: config.verifyEveryActions ?? 4,
        };
    }
    async run(input, sessionId = `all-llm-${Date.now()}`) {
        logger.info(`All-LLM command session: ${sessionId}`);
        await this.browser.initialize();
        await this.browser.navigateTo(input.url);
        const executor = new LlmCommandExecutorAgent_1.LlmCommandExecutorAgent(this.browser.page);
        const history = [];
        let lastError;
        for (let actionIndex = 1; actionIndex <= this.config.maxActions; actionIndex += 1) {
            const snapshot = await (0, AomExtractor_1.extractAomSnapshot)(this.browser.page);
            const command = await this.agent.decide({
                goal: input,
                snapshot,
                history,
                lastError,
            });
            if (command.status === "complete") {
                const verification = await this.safeVerify(input, history);
                return this.finish("passed", input, history, verification, command.reasoning);
            }
            if (command.status === "blocked") {
                return this.finish("blocked", input, history, undefined, command.reasoning);
            }
            const result = await executor.execute(command);
            const entry = await this.historyEntry(command, result);
            entry.index = history.length + 1;
            history.push(entry);
            lastError = result.success ? undefined : result.errorMessage ?? "Unknown failure";
            if (this.shouldVerify(actionIndex, history)) {
                const verification = await this.safeVerify(input, history);
                if (verification?.isComplete && verification.confidence !== "low") {
                    return this.finish("passed", input, history, verification);
                }
            }
            if (this.config.stepDelayMs > 0) {
                await this.sleep(this.config.stepDelayMs);
            }
        }
        const verification = await this.safeVerify(input, history);
        return this.finish(verification?.isComplete && verification.confidence !== "low" ? "passed" : "failed", input, history, verification, verification?.isComplete ? undefined : "Maximum all-LLM actions reached.");
    }
    async historyEntry(command, result) {
        const observedAfter = await this.captureObservedAfter().catch(() => undefined);
        return {
            index: 0,
            command,
            success: result.success,
            actionPerformed: result.actionPerformed,
            errorMessage: result.errorMessage,
            urlAfter: this.browser.page.url(),
            observedAfter,
        };
    }
    async captureObservedAfter() {
        const snapshot = await (0, AomExtractor_1.extractAomSnapshot)(this.browser.page);
        return [
            `URL: ${snapshot.url}`,
            `Title: ${snapshot.title}`,
            `Visible text: ${snapshot.visibleText.slice(0, 1200)}`,
        ].join("\n");
    }
    async safeVerify(input, history) {
        try {
            const snapshot = await (0, AomExtractor_1.extractAomSnapshot)(this.browser.page);
            return await this.verifier.verify({
                goal: input,
                snapshot,
                history: history.map((entry, index) => ({
                    index: index + 1,
                    instruction: `${entry.command.actionType ?? entry.command.status}`,
                    expectedOutcome: entry.command.expectedOutcome,
                    success: entry.success,
                    errorMessage: entry.errorMessage,
                    actionPerformed: entry.actionPerformed,
                    urlAfter: entry.urlAfter,
                    observedAfter: entry.observedAfter,
                })),
            });
        }
        catch {
            return undefined;
        }
    }
    shouldVerify(actionIndex, history) {
        return history.length > 0 && actionIndex % this.config.verifyEveryActions === 0;
    }
    finish(status, input, history, verification, errorMessage) {
        const result = { status, goal: input.goal, history, verification, errorMessage };
        logger.info(`All-LLM command result: ${status}`, {
            steps: history.length,
            errorMessage,
        });
        return result;
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
exports.AllLlmOrchestrator = AllLlmOrchestrator;
