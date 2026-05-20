// src/core/DirectRunner.ts
// Führt vordefinierte TestSteps direkt aus – ohne Planner-Agent.
// Der Analyst + Executor + Critic Loop bleibt vollständig erhalten.
// Version: Playwright-only, ohne Stagehand.

import { BrowserManager } from "./BrowserManager";
import { StateManager } from "./StateManager";
import { DomAnalystAgent } from "../agents/DomAnalystAgent";
import { ExecutorAgent } from "../agents/ExecutorAgent";
import { CriticAgent } from "../agents/CriticAgent";
import { extractAomSnapshot } from "../utils/AomExtractor";
import { Logger } from "../utils/Logger";

const logger = new Logger("DirectRunner");

export interface TestStep {
  id: number;
  instruction: string;
}

export interface DirectRunnerConfig {
  startUrl: string;
  stepDelayMs?: number;
  screenshotOnFailure?: boolean;
}

export class DirectRunner {
  private readonly browser: BrowserManager;
  private readonly analyst: DomAnalystAgent;
  private readonly critic: CriticAgent;
  private readonly config: Required<DirectRunnerConfig>;

  constructor(config: DirectRunnerConfig) {
    this.browser = BrowserManager.getInstance();
    this.analyst = new DomAnalystAgent();
    this.critic = new CriticAgent();

    this.config = {
      stepDelayMs: 800,
      screenshotOnFailure: true,
      ...config,
    };
  }

  public async run(
    steps: TestStep[],
    sessionId = `direct-${Date.now()}`
  ): Promise<StateManager> {
    logger.info(`\n${"═".repeat(60)}`);
    logger.info(` DirectRunner: ${steps.length} steps, session ${sessionId}`);
    logger.info(` URL: ${this.config.startUrl}`);
    logger.info(`${"═".repeat(60)}\n`);

    await this.browser.initialize();
    await this.browser.navigateTo(this.config.startUrl);

    const state = new StateManager(
      sessionId,
      `Direct test: ${steps.length} steps`,
      this.config.startUrl
    );

    state.loadSteps(steps.map((s) => s.instruction));

    const executor = new ExecutorAgent(this.browser.page);

    while (!state.isFinished()) {
      const currentStep = state.getCurrentStep();
      if (!currentStep) break;

      logger.info(
        `\n── Step ${currentStep.stepIndex + 1}/${steps.length}: "${
          currentStep.instruction
        }" ──`
      );

      state.markStepRunning();

      const snapshot = await extractAomSnapshot(this.browser.page);

      logger.info(
        `AOM extracted: ${snapshot.filteredNodeCount} filtered nodes from ${snapshot.url}`
      );

      const previousError =
        currentStep.retryCount > 0 ? currentStep.error : undefined;

      const decision = await this.analyst.analyze({
        instruction: currentStep.instruction,
        // Wichtig: ganzen Snapshot geben, nicht nur snapshot.nodes.
        // Dadurch sieht der Analyst URL, Title und Node-Struktur zusammen.
        aomTree: snapshot as any,
        previousError,
      });

      const result = await executor.execute(decision);

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
        } catch (screenshotError) {
          logger.warn(
            "Could not capture screenshot:",
            screenshotError instanceof Error
              ? screenshotError.message
              : String(screenshotError)
          );
        }
      }

      const failureSnapshot = await extractAomSnapshot(this.browser.page);

      const criticDecision = await this.critic.evaluate({
        failedInstruction: currentStep.instruction,
        errorMessage: result.errorMessage ?? "Unknown error",
        // Auch hier ganzen Snapshot geben.
        aomTreeAfterFailure: failureSnapshot as any,
        retryCount: currentStep.retryCount,
      });

      if (criticDecision.abort) {
        state.markStepFailed(result.errorMessage ?? "Aborted by Critic");
      } else if (criticDecision.shouldRetry) {
        state.markStepRetrying(
          result.errorMessage ?? "Unknown error",
          criticDecision.revisedInstruction
        );

        await this.sleep(1200);
      } else {
        state.markStepFailed(result.errorMessage ?? "Critic declined retry");
      }
    }

    console.log(state.getSummary());

    return state;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}