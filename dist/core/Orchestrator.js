"use strict";
// src/core/Orchestrator.ts
// Schritt 4: Haupt-Orchestrator – der "Dirigent" aller Agenten.
// Implementiert den Plan → Analyze → Execute → Critique Loop.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Orchestrator = void 0;
const BrowserManager_1 = require("./BrowserManager");
const StateManager_1 = require("./StateManager");
const PlannerAgent_1 = require("../agents/PlannerAgent");
const DomAnalystAgent_1 = require("../agents/DomAnalystAgent");
const ExecutorAgent_1 = require("../agents/ExecutorAgent");
const CriticAgent_1 = require("../agents/CriticAgent");
const AomExtractor_1 = require("../utils/AomExtractor");
const Logger_1 = require("../utils/Logger");
const logger = new Logger_1.Logger("Orchestrator");
class Orchestrator {
    browser;
    planner;
    analyst;
    critic;
    config;
    constructor(config = {}) {
        this.browser = BrowserManager_1.BrowserManager.getInstance();
        this.planner = new PlannerAgent_1.PlannerAgent();
        this.analyst = new DomAnalystAgent_1.DomAnalystAgent();
        this.critic = new CriticAgent_1.CriticAgent();
        this.config = {
            stepDelayMs: config.stepDelayMs ?? 500,
            screenshotOnFailure: config.screenshotOnFailure ?? true,
        };
    }
    /**
     * Führt eine vollständige Test-Session aus:
     * 1. Browser initialisieren & zur URL navigieren
     * 2. Planner erstellt Schritt-für-Schritt-Plan
     * 3. Für jeden Schritt: AOM extrahieren → Analyst → Executor → (Critic bei Fehler)
     * 4. Summary ausgeben
     *
     * @param input   Testziel, URL und optionaler Kontext
     * @param sessionId  Eindeutige ID (Default: Timestamp)
     */
    async run(input, sessionId = `session-${Date.now()}`) {
        logger.info(`\n${"═".repeat(60)}`);
        logger.info(` Starting test session: ${sessionId}`);
        logger.info(` Goal: ${input.goal}`);
        logger.info(`${"═".repeat(60)}\n`);
        const state = new StateManager_1.StateManager(sessionId, input.goal, input.url);
        await this.browser.initialize();
        await this.browser.navigateTo(input.url);
        const plan = await this.planner.plan(input);
        state.loadSteps(plan.steps);
        const executor = new ExecutorAgent_1.ExecutorAgent(this.browser.page);
        while (!state.isFinished()) {
            const currentStep = state.getCurrentStep();
            if (!currentStep)
                break;
            logger.info(`\n── Step ${currentStep.stepIndex + 1}: "${currentStep.instruction}" ──`);
            state.markStepRunning();
            const snapshot = await (0, AomExtractor_1.extractAomSnapshot)(this.browser.page);
            const previousError = currentStep.retryCount > 0 ? currentStep.error : undefined;
            const decision = await this.analyst.analyze({
                instruction: currentStep.instruction,
                aomTree: snapshot.nodes,
                previousError,
            });
            const result = await executor.execute(decision);
            if (result.success) {
                state.markStepSuccess(result);
                if (this.config.stepDelayMs > 0) {
                    await this.sleep(this.config.stepDelayMs);
                }
            }
            else {
                logger.warn(`Step failed. Invoking Critic...`);
                if (this.config.screenshotOnFailure) {
                    const screenshot = await this.browser.takeScreenshot();
                    result.screenshotBase64 = screenshot;
                    logger.debug(`Screenshot captured for failed step.`);
                }
                const failureSnapshot = await (0, AomExtractor_1.extractAomSnapshot)(this.browser.page);
                const criticDecision = await this.critic.evaluate({
                    failedInstruction: currentStep.instruction,
                    errorMessage: result.errorMessage ?? "Unknown error",
                    aomTreeAfterFailure: failureSnapshot.nodes,
                    retryCount: currentStep.retryCount,
                });
                if (criticDecision.abort) {
                    state.markStepFailed(result.errorMessage ?? "Aborted by Critic");
                }
                else if (criticDecision.shouldRetry) {
                    state.markStepRetrying(result.errorMessage ?? "Unknown error", criticDecision.revisedInstruction);
                    // Kurze Pause vor Retry
                    await this.sleep(1000);
                }
                else {
                    state.markStepFailed(result.errorMessage ?? "Critic declined retry");
                }
            }
        }
        // 4) Summary
        console.log(state.getSummary());
        return state;
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
exports.Orchestrator = Orchestrator;
