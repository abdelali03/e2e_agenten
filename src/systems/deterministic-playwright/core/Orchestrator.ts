// src/core/Orchestrator.ts
// Schritt 4: Haupt-Orchestrator – der "Dirigent" aller Agenten.
// Implementiert den Plan → Analyze → Execute → Critique Loop.

import { BrowserManager } from "./BrowserManager";
import { StateManager } from "./StateManager";
import { PlannerAgent } from "../agents/PlannerAgent";
import { DomAnalystAgent } from "../agents/DomAnalystAgent";
import { ExecutorAgent } from "../agents/ExecutorAgent";
import { CriticAgent } from "../agents/CriticAgent";
import { extractAomSnapshot } from "../../../utils/AomExtractor";
import { Logger } from "../../../utils/Logger";
import { PlannerInput } from "../../../core/types";

const logger = new Logger("Orchestrator");

export interface OrchestratorConfig {
  /** Millisekunden Pause zwischen Schritten (hilft bei langsamen SPAs) */
  stepDelayMs?: number;
  /** Screenshot bei Fehlern anfertigen? */
  screenshotOnFailure?: boolean;
}

export class Orchestrator {
  private readonly browser: BrowserManager;
  private readonly planner: PlannerAgent;
  private readonly analyst: DomAnalystAgent;
  private readonly critic: CriticAgent;
  private readonly config: Required<OrchestratorConfig>;

  constructor(config: OrchestratorConfig = {}) {
    this.browser = BrowserManager.getInstance();
    this.planner = new PlannerAgent();
    this.analyst = new DomAnalystAgent();
    this.critic = new CriticAgent();
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
  public async run(
    input: PlannerInput,
    sessionId = `session-${Date.now()}`
  ): Promise<StateManager> {
    logger.info(`\n${"═".repeat(60)}`);
    logger.info(` Starting test session: ${sessionId}`);
    logger.info(` Goal: ${input.goal}`);
    logger.info(`${"═".repeat(60)}\n`);

    const state = new StateManager(sessionId, input.goal, input.url);

    await this.browser.initialize();
    await this.browser.navigateTo(input.url);

    const plan = await this.planner.plan(input);
    state.loadSteps(plan.steps);

    const executor = new ExecutorAgent(this.browser.page);

    while (!state.isFinished()) {
      const currentStep = state.getCurrentStep();
      if (!currentStep) break;

      logger.info(`\n── Step ${currentStep.stepIndex + 1}: "${currentStep.instruction}" ──`);

      state.markStepRunning();

      const snapshot = await extractAomSnapshot(this.browser.page);
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
      } else {
        logger.warn(`Step failed. Invoking Critic...`);

        if (this.config.screenshotOnFailure) {
          const screenshot = await this.browser.takeScreenshot();
          result.screenshotBase64 = screenshot;
          logger.debug(`Screenshot captured for failed step.`);
        }

        const failureSnapshot = await extractAomSnapshot(this.browser.page);

        const criticDecision = await this.critic.evaluate({
          failedInstruction: currentStep.instruction,
          errorMessage: result.errorMessage ?? "Unknown error",
          aomTreeAfterFailure: failureSnapshot.nodes,
          retryCount: currentStep.retryCount,
        });

        if (criticDecision.abort) {
          state.markStepFailed(result.errorMessage ?? "Aborted by Critic");
        } else if (criticDecision.shouldRetry) {
          state.markStepRetrying(
            result.errorMessage ?? "Unknown error",
            criticDecision.revisedInstruction
          );
          // Kurze Pause vor Retry
          await this.sleep(1000);
        } else {
          state.markStepFailed(result.errorMessage ?? "Critic declined retry");
        }
      }
    }

    // 4) Summary
    console.log(state.getSummary());

    return state;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
