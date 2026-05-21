"use strict";
// src/core/DirectRunner.ts
// Führt vordefinierte TestSteps direkt aus – ohne Planner-Agent.
// Der Analyst + Executor + Critic Loop bleibt vollständig erhalten.
// Version: Playwright-only, ohne Stagehand.
Object.defineProperty(exports, "__esModule", { value: true });
exports.DirectRunner = void 0;
const BrowserManager_1 = require("./BrowserManager");
const StateManager_1 = require("./StateManager");
const DomAnalystAgent_1 = require("../agents/DomAnalystAgent");
const ExecutorAgent_1 = require("../agents/ExecutorAgent");
const CriticAgent_1 = require("../agents/CriticAgent");
const AomExtractor_1 = require("../utils/AomExtractor");
const Logger_1 = require("../utils/Logger");
const logger = new Logger_1.Logger("DirectRunner");
class DirectRunner {
    browser;
    analyst;
    critic;
    config;
    constructor(config) {
        this.browser = BrowserManager_1.BrowserManager.getInstance();
        this.analyst = new DomAnalystAgent_1.DomAnalystAgent();
        this.critic = new CriticAgent_1.CriticAgent();
        this.config = {
            stepDelayMs: 800,
            screenshotOnFailure: true,
            ...config,
        };
    }
    async run(steps, sessionId = `direct-${Date.now()}`) {
        logger.info(`\n${"═".repeat(60)}`);
        logger.info(` DirectRunner: ${steps.length} steps, session ${sessionId}`);
        logger.info(` URL: ${this.config.startUrl}`);
        logger.info(`${"═".repeat(60)}\n`);
        await this.browser.initialize();
        await this.browser.navigateTo(this.config.startUrl);
        const state = new StateManager_1.StateManager(sessionId, `Direct test: ${steps.length} steps`, this.config.startUrl);
        state.loadSteps(steps.map((s) => s.instruction));
        const executor = new ExecutorAgent_1.ExecutorAgent(this.browser.page);
        while (!state.isFinished()) {
            const currentStep = state.getCurrentStep();
            if (!currentStep)
                break;
            logger.info(`\n── Step ${currentStep.stepIndex + 1}/${steps.length}: "${currentStep.instruction}" ──`);
            state.markStepRunning();
            const snapshot = await (0, AomExtractor_1.extractAomSnapshot)(this.browser.page);
            logger.info(`AOM extracted: ${snapshot.filteredNodeCount} filtered nodes from ${snapshot.url}`);
            const previousError = currentStep.retryCount > 0 ? currentStep.error : undefined;
            const result = await this.analyzeAndExecute(executor, currentStep.instruction, snapshot, previousError);
            if (result.success) {
                state.markStepSuccess(result);
                if (this.config.stepDelayMs > 0) {
                    await this.sleep(this.config.stepDelayMs);
                }
                continue;
            }
            logger.warn("Step failed. Invoking Critic...");
            if (this.config.screenshotOnFailure) {
                try {
                    result.screenshotBase64 = await this.browser.takeScreenshot();
                    logger.debug("Screenshot captured for failed step.");
                }
                catch (screenshotError) {
                    logger.warn("Could not capture screenshot:", screenshotError instanceof Error
                        ? screenshotError.message
                        : String(screenshotError));
                }
            }
            const failureSnapshot = await (0, AomExtractor_1.extractAomSnapshot)(this.browser.page);
            let criticDecision;
            try {
                criticDecision = await this.critic.evaluate({
                    failedInstruction: currentStep.instruction,
                    errorMessage: result.errorMessage ?? "Unknown error",
                    // Auch hier ganzen Snapshot geben.
                    aomTreeAfterFailure: failureSnapshot,
                    retryCount: currentStep.retryCount,
                });
            }
            catch (criticError) {
                const criticMessage = criticError instanceof Error ? criticError.message : String(criticError);
                state.markStepFailed(`Critic failed while evaluating recovery: ${criticMessage}. Original error: ${result.errorMessage ?? "Unknown error"}`);
                continue;
            }
            if (criticDecision.abort) {
                state.markStepFailed(result.errorMessage ?? "Aborted by Critic");
            }
            else if (criticDecision.shouldRetry) {
                state.markStepRetrying(result.errorMessage ?? "Unknown error", criticDecision.revisedInstruction);
                await this.sleep(1200);
            }
            else {
                state.markStepFailed(result.errorMessage ?? "Critic declined retry");
            }
        }
        console.log(state.getSummary());
        return state;
    }
    async analyzeAndExecute(executor, instruction, snapshot, previousError) {
        const start = Date.now();
        try {
            const decision = await this.analyst.analyze({
                instruction,
                // Wichtig: ganzen Snapshot geben, nicht nur snapshot.nodes.
                // Dadurch sieht der Analyst URL, Title und Node-Struktur zusammen.
                aomTree: snapshot,
                previousError,
            });
            return await executor.execute(decision);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const durationMs = Date.now() - start;
            logger.warn(`Analyze/execute failed after ${durationMs}ms: ${errorMessage}`);
            return {
                success: false,
                actionPerformed: `Analyze/execute step "${instruction}"`,
                errorMessage,
                durationMs,
            };
        }
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
exports.DirectRunner = DirectRunner;
