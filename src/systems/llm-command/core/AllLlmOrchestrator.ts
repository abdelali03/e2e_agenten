import { AllLlmAgent } from "../agents/AllLlmAgent";
import { LlmCommandExecutorAgent } from "../agents/LlmCommandExecutorAgent";
import { GoalVerifierAgent } from "../../deterministic-playwright/agents/GoalVerifierAgent";
import { BrowserManager } from "../../deterministic-playwright/core/BrowserManager";
import { extractAomSnapshot } from "../../../utils/AomExtractor";
import { Logger } from "../../../utils/Logger";
import type {
  ActionResult,
  AllLlmHistoryEntry,
  GoalInput,
  GoalVerificationOutput,
  LlmBrowserCommand,
} from "../../../core/types";

const logger = new Logger("AllLlmOrchestrator");

export interface AllLlmOrchestratorConfig {
  maxActions?: number;
  stepDelayMs?: number;
  verifyEveryActions?: number;
}

export interface AllLlmRunResult {
  status: "passed" | "failed" | "blocked";
  goal: string;
  history: AllLlmHistoryEntry[];
  verification?: GoalVerificationOutput;
  errorMessage?: string;
}

export class AllLlmOrchestrator {
  private readonly browser = BrowserManager.getInstance();
  private readonly agent = new AllLlmAgent();
  private readonly verifier = new GoalVerifierAgent();
  private readonly config: Required<AllLlmOrchestratorConfig>;

  constructor(config: AllLlmOrchestratorConfig = {}) {
    this.config = {
      maxActions: config.maxActions ?? 40,
      stepDelayMs: config.stepDelayMs ?? 800,
      verifyEveryActions: config.verifyEveryActions ?? 4,
    };
  }

  public async run(
    input: GoalInput,
    sessionId = `all-llm-${Date.now()}`
  ): Promise<AllLlmRunResult> {
    logger.info(`All-LLM command session: ${sessionId}`);

    await this.browser.initialize();
    await this.browser.navigateTo(input.url);

    const executor = new LlmCommandExecutorAgent(this.browser.page);
    const history: AllLlmHistoryEntry[] = [];
    let lastError: string | undefined;

    for (let actionIndex = 1; actionIndex <= this.config.maxActions; actionIndex += 1) {
      const snapshot = await extractAomSnapshot(this.browser.page);
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
    return this.finish(
      verification?.isComplete && verification.confidence !== "low" ? "passed" : "failed",
      input,
      history,
      verification,
      verification?.isComplete ? undefined : "Maximum all-LLM actions reached."
    );
  }

  private async historyEntry(
    command: LlmBrowserCommand,
    result: ActionResult
  ): Promise<AllLlmHistoryEntry> {
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

  private async captureObservedAfter(): Promise<string> {
    const snapshot = await extractAomSnapshot(this.browser.page);
    return [
      `URL: ${snapshot.url}`,
      `Title: ${snapshot.title}`,
      `Visible text: ${snapshot.visibleText.slice(0, 1200)}`,
    ].join("\n");
  }

  private async safeVerify(
    input: GoalInput,
    history: AllLlmHistoryEntry[]
  ): Promise<GoalVerificationOutput | undefined> {
    try {
      const snapshot = await extractAomSnapshot(this.browser.page);
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
    } catch {
      return undefined;
    }
  }

  private shouldVerify(actionIndex: number, history: AllLlmHistoryEntry[]): boolean {
    return history.length > 0 && actionIndex % this.config.verifyEveryActions === 0;
  }

  private finish(
    status: AllLlmRunResult["status"],
    input: GoalInput,
    history: AllLlmHistoryEntry[],
    verification?: GoalVerificationOutput,
    errorMessage?: string
  ): AllLlmRunResult {
    const result = { status, goal: input.goal, history, verification, errorMessage };
    logger.info(`All-LLM command result: ${status}`, {
      steps: history.length,
      errorMessage,
    });
    return result;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
