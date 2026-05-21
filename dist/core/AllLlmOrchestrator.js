"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllLlmOrchestrator = void 0;
const AllLlmAgent_1 = require("../agents/AllLlmAgent");
const LlmCommandExecutorAgent_1 = require("../agents/LlmCommandExecutorAgent");
const GoalVerifierAgent_1 = require("../agents/GoalVerifierAgent");
const BrowserManager_1 = require("./BrowserManager");
const AomExtractor_1 = require("../utils/AomExtractor");
const Logger_1 = require("../utils/Logger");
const logger = new Logger_1.Logger("AllLlmOrchestrator");
class AllLlmOrchestrator {
    browser;
    agent;
    verifier;
    config;
    constructor(config = {}) {
        this.browser = BrowserManager_1.BrowserManager.getInstance();
        this.agent = new AllLlmAgent_1.AllLlmAgent();
        this.verifier = new GoalVerifierAgent_1.GoalVerifierAgent();
        this.config = {
            maxActions: config.maxActions ?? 40,
            stepDelayMs: config.stepDelayMs ?? 800,
            verifyEveryActions: config.verifyEveryActions ?? 4,
        };
    }
    async run(input, sessionId = `all-llm-${Date.now()}`) {
        logger.info(`\n${"=".repeat(60)}`);
        logger.info(` All-LLM session: ${sessionId}`);
        logger.info(` Goal: ${input.goal}`);
        logger.info(`${"=".repeat(60)}\n`);
        await this.browser.initialize();
        await this.browser.navigateTo(input.url);
        const executor = new LlmCommandExecutorAgent_1.LlmCommandExecutorAgent(this.browser.page);
        const history = [];
        let lastError;
        for (let actionIndex = 1; actionIndex <= this.config.maxActions; actionIndex += 1) {
            const snapshot = await (0, AomExtractor_1.extractAomSnapshot)(this.browser.page);
            if (this.shouldVerify(actionIndex, history)) {
                const verification = await this.safeVerify(input, history);
                if (verification?.isComplete && verification.confidence !== "low") {
                    return this.finish("passed", input, history, verification);
                }
            }
            const command = await this.agent.decide({
                goal: input,
                snapshot,
                history,
                lastError,
            });
            if (command.status === "complete") {
                const verification = await this.safeVerify(input, history);
                if (verification?.isComplete && verification.confidence !== "low") {
                    return this.finish("passed", input, history, verification);
                }
                lastError =
                    "All-LLM agent marked complete, but verifier did not find enough evidence.";
                logger.warn(lastError, verification);
                const entry = await this.historyEntry(command, this.syntheticFailure(lastError));
                entry.index = history.length + 1;
                history.push(entry);
                continue;
            }
            if (command.status === "blocked") {
                const verification = await this.safeVerify(input, history);
                return this.finish("blocked", input, history, verification, command.reasoning);
            }
            logger.info(`\n-- All-LLM action ${actionIndex}/${this.config.maxActions}: ${command.actionType} --`);
            const result = await executor.execute(command);
            const entry = await this.historyEntry(command, result);
            entry.index = history.length + 1;
            history.push(entry);
            lastError = result.success ? undefined : result.errorMessage ?? "Unknown failure";
            if (this.config.stepDelayMs > 0) {
                await this.sleep(this.config.stepDelayMs);
            }
        }
        const verification = await this.safeVerify(input, history);
        if (verification?.isComplete && verification.confidence !== "low") {
            return this.finish("passed", input, history, verification);
        }
        return this.finish("failed", input, history, verification, `Maximum all-LLM actions (${this.config.maxActions}) reached before goal completion.`);
    }
    async historyEntry(command, result) {
        const observedAfter = await this.captureObservedAfter().catch((error) => {
            logger.warn("Could not capture all-LLM observation:", error instanceof Error ? error.message : String(error));
            return undefined;
        });
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
                    instruction: `${entry.command.actionType ?? entry.command.status} ${JSON.stringify(entry.command.locator ?? {})}`,
                    expectedOutcome: entry.command.expectedOutcome,
                    success: entry.success,
                    errorMessage: entry.errorMessage,
                    actionPerformed: entry.actionPerformed,
                    urlAfter: entry.urlAfter,
                    observedAfter: entry.observedAfter,
                })),
            });
        }
        catch (error) {
            logger.warn("All-LLM goal verification failed:", error instanceof Error ? error.message : String(error));
            return undefined;
        }
    }
    shouldVerify(actionIndex, history) {
        if (history.length === 0) {
            return false;
        }
        const last = history[history.length - 1];
        return (last.success &&
            (actionIndex % this.config.verifyEveryActions === 0 ||
                /save|speichern|submit|create|erstellen|confirm|best.tigen/i.test(`${last.command.actionType ?? ""} ${last.command.value ?? ""} ${last.command.expectedOutcome ?? ""}`)));
    }
    syntheticFailure(errorMessage) {
        return {
            success: false,
            actionPerformed: "complete",
            errorMessage,
            durationMs: 0,
        };
    }
    finish(status, input, history, verification, errorMessage) {
        const indexedHistory = history.map((entry, index) => ({
            ...entry,
            index: index + 1,
        }));
        const result = {
            status,
            goal: input.goal,
            history: indexedHistory,
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
            ` ALL-LLM TEST SUMMARY`,
            `${"=".repeat(50)}`,
            ` Goal:   ${result.goal}`,
            ` Status: ${result.status.toUpperCase()}`,
            ` Steps:  ${succeeded}/${result.history.length} commands succeeded`,
            result.verification
                ? ` Verify: complete=${result.verification.isComplete}, confidence=${result.verification.confidence}`
                : ` Verify: not available`,
            result.errorMessage ? ` Error:  ${result.errorMessage}` : "",
            `${"=".repeat(50)}`,
            ...result.history.map((entry) => {
                const icon = entry.success ? "OK" : "FAIL";
                const error = entry.errorMessage ? ` -> ${entry.errorMessage}` : "";
                return ` ${icon} ${entry.index}. ${entry.actionPerformed}${error}`;
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
exports.AllLlmOrchestrator = AllLlmOrchestrator;
