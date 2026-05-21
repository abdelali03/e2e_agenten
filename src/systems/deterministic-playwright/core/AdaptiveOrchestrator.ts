import { BrowserManager } from "./BrowserManager";
import { AdaptivePlannerAgent } from "../agents/AdaptivePlannerAgent";
import { DomAnalystAgent } from "../agents/DomAnalystAgent";
import { ExecutorAgent } from "../agents/ExecutorAgent";
import { CriticAgent } from "../agents/CriticAgent";
import { GoalVerifierAgent } from "../agents/GoalVerifierAgent";
import { extractAomSnapshot } from "../../../utils/AomExtractor";
import { Logger } from "../../../utils/Logger";
import { VisionClient } from "../../../utils/VisionClient";
import type {
  ActionResult,
  AdaptiveHistoryEntry,
  GoalInput,
  GoalVerificationOutput,
} from "../../../core/types";

const logger = new Logger("AdaptiveOrchestrator");

export interface AdaptiveOrchestratorConfig {
  maxActions?: number;
  maxRetriesPerAction?: number;
  stepDelayMs?: number;
  screenshotOnFailure?: boolean;
  verifyEveryActions?: number;
}

export interface AdaptiveRunResult {
  status: "passed" | "failed" | "blocked";
  goal: string;
  history: AdaptiveHistoryEntry[];
  verification?: GoalVerificationOutput;
  errorMessage?: string;
}

export class AdaptiveOrchestrator {
  private readonly browser: BrowserManager;
  private readonly planner: AdaptivePlannerAgent;
  private readonly analyst: DomAnalystAgent;
  private readonly critic: CriticAgent;
  private readonly verifier: GoalVerifierAgent;
  private readonly vision: VisionClient;
  private readonly config: Required<AdaptiveOrchestratorConfig>;

  constructor(config: AdaptiveOrchestratorConfig = {}) {
    this.browser = BrowserManager.getInstance();
    this.planner = new AdaptivePlannerAgent();
    this.analyst = new DomAnalystAgent();
    this.critic = new CriticAgent();
    this.verifier = new GoalVerifierAgent();
    this.vision = new VisionClient();
    this.config = {
      maxActions: config.maxActions ?? 30,
      maxRetriesPerAction: config.maxRetriesPerAction ?? 3,
      stepDelayMs: config.stepDelayMs ?? 800,
      screenshotOnFailure: config.screenshotOnFailure ?? true,
      verifyEveryActions: config.verifyEveryActions ?? 3,
    };
  }

  public async run(
    input: GoalInput,
    sessionId = `adaptive-${Date.now()}`
  ): Promise<AdaptiveRunResult> {
    logger.info(`\n${"=".repeat(60)}`);
    logger.info(` Adaptive session: ${sessionId}`);
    logger.info(` Goal: ${input.goal}`);
    logger.info(`${"=".repeat(60)}\n`);

    await this.browser.initialize();
    await this.browser.navigateTo(input.url);

    const executor = new ExecutorAgent(this.browser.page);
    const history: AdaptiveHistoryEntry[] = [];
    let lastError: string | undefined;
    let repeatedInstructionCount = 0;

    for (let actionIndex = 1; actionIndex <= this.config.maxActions; actionIndex += 1) {
      const snapshot = await extractAomSnapshot(this.browser.page);

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

      const instruction = next.instruction!.trim();
      repeatedInstructionCount = this.updateRepeatCount(
        history,
        instruction,
        repeatedInstructionCount
      );

      if (repeatedInstructionCount > this.config.maxRetriesPerAction) {
        return this.finish(
          "failed",
          input,
          history,
          undefined,
          `Planner repeated the same instruction too often: "${instruction}"`
        );
      }

      logger.info(`\n-- Adaptive action ${actionIndex}/${this.config.maxActions}: "${instruction}" --`);

      const result = await this.executeWithRecovery(
        executor,
        input,
        instruction,
        next.expectedOutcome,
        history
      );

      const observedAfter = await this.captureObservedAfter().catch((error) => {
        logger.warn(
          "Could not capture post-action observation:",
          error instanceof Error ? error.message : String(error)
        );
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
      } else {
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

    return this.finish(
      "failed",
      input,
      history,
      verification,
      `Maximum adaptive actions (${this.config.maxActions}) reached before goal completion.`
    );
  }

  private async executeWithRecovery(
    executor: ExecutorAgent,
    input: GoalInput,
    instruction: string,
    expectedOutcome: string | undefined,
    history: AdaptiveHistoryEntry[]
  ): Promise<ActionResult> {
    let currentInstruction = instruction;
    let previousError: string | undefined;
    let visualContext: string | undefined;

    for (let attempt = 0; attempt <= this.config.maxRetriesPerAction; attempt += 1) {
      const result = await this.analyzeAndExecute(
        executor,
        currentInstruction,
        previousError,
        visualContext
      );

      if (result.success) {
        return result;
      }

      previousError = result.errorMessage ?? "Unknown error";

      if (this.config.screenshotOnFailure) {
        await this.tryCaptureScreenshot();
      }

      if (attempt >= 1 && !visualContext) {
        visualContext = await this.captureVisualContext(
          input,
          currentInstruction,
          previousError,
          expectedOutcome
        );
      }

      if (attempt >= this.config.maxRetriesPerAction) {
        return result;
      }

      const failureSnapshot = await extractAomSnapshot(this.browser.page);

      try {
        const criticDecision = await this.critic.evaluate({
          failedInstruction: currentInstruction,
          errorMessage: previousError,
          aomTreeAfterFailure: failureSnapshot as any,
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
      } catch (criticError) {
        const criticMessage =
          criticError instanceof Error ? criticError.message : String(criticError);

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
      errorMessage: `Action did not succeed. Expected outcome: ${
        expectedOutcome ?? "not specified"
      }`,
      durationMs: 0,
    };
  }

  private async analyzeAndExecute(
    executor: ExecutorAgent,
    instruction: string,
    previousError?: string,
    visualContext?: string
  ): Promise<ActionResult> {
    const start = Date.now();

    try {
      const snapshot = await extractAomSnapshot(this.browser.page);
      const decision = await this.analyst.analyze({
        instruction,
        aomTree: snapshot as any,
        previousError,
        visualContext,
      });

      return await executor.execute(decision);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        success: false,
        actionPerformed: `Analyze/execute "${instruction}"`,
        errorMessage,
        durationMs: Date.now() - start,
      };
    }
  }

  private async captureObservedAfter(): Promise<string> {
    const snapshot = await extractAomSnapshot(this.browser.page);
    return [
      `URL: ${snapshot.url}`,
      `Title: ${snapshot.title}`,
      `Visible text: ${snapshot.visibleText.slice(0, 1200)}`,
    ].join("\n");
  }

  private async captureVisualContext(
    input: GoalInput,
    instruction: string,
    errorMessage: string,
    expectedOutcome?: string
  ): Promise<string | undefined> {
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
    } catch (error) {
      logger.warn(
        "Could not capture visual recovery context:",
        error instanceof Error ? error.message : String(error)
      );
      return undefined;
    }
  }

  private async safeVerify(
    input: GoalInput,
    history: AdaptiveHistoryEntry[]
  ): Promise<GoalVerificationOutput | undefined> {
    try {
      const snapshot = await extractAomSnapshot(this.browser.page);
      return await this.verifier.verify({
        goal: input,
        snapshot,
        history,
      });
    } catch (error) {
      logger.warn(
        "Goal verification failed:",
        error instanceof Error ? error.message : String(error)
      );
      return undefined;
    }
  }

  private shouldVerify(
    actionIndex: number,
    history: AdaptiveHistoryEntry[]
  ): boolean {
    if (history.length === 0) {
      return false;
    }

    const lastActionSucceeded = history[history.length - 1]?.success === true;

    return (
      lastActionSucceeded &&
      (actionIndex % this.config.verifyEveryActions === 0 ||
        /submit|create|erstellen|speichern|save|confirm/i.test(
          history[history.length - 1].instruction
        ))
    );
  }

  private updateRepeatCount(
    history: AdaptiveHistoryEntry[],
    instruction: string,
    currentCount: number
  ): number {
    const previous = history[history.length - 1]?.instruction;

    if (previous && previous.toLowerCase() === instruction.toLowerCase()) {
      return currentCount + 1;
    }

    return 1;
  }

  private async tryCaptureScreenshot(): Promise<void> {
    try {
      await this.browser.takeScreenshot();
      logger.debug("Screenshot captured for failed adaptive action.");
    } catch (error) {
      logger.warn(
        "Could not capture screenshot:",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private finish(
    status: AdaptiveRunResult["status"],
    input: GoalInput,
    history: AdaptiveHistoryEntry[],
    verification?: GoalVerificationOutput,
    errorMessage?: string
  ): AdaptiveRunResult {
    const result: AdaptiveRunResult = {
      status,
      goal: input.goal,
      history,
      verification,
      errorMessage,
    };

    console.log(this.getSummary(result));
    return result;
  }

  private getSummary(result: AdaptiveRunResult): string {
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

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
