import { SessionState, AgentStep } from "../../../core/types";
import { Logger } from "../../../utils/Logger";

const logger = new Logger("StateManager");

export class StateManager {
  private state: SessionState;

  constructor(sessionId: string, goal: string, url: string) {
    this.state = {
      sessionId,
      goal,
      url,
      steps: [],
      currentStepIndex: 0,
      isComplete: false,
      hasFailed: false,
    };
    logger.info(`Session initialized: ${sessionId}`, { goal, url });
  }


  public getState(): Readonly<SessionState> {
    return this.state;
  }

  public getCurrentStep(): AgentStep | undefined {
    return this.state.steps[this.state.currentStepIndex];
  }

  public isFinished(): boolean {
    return this.state.isComplete || this.state.hasFailed;
  }


  public loadSteps(instructions: string[]): void {
    this.state.steps = instructions.map((instruction, i) => ({
      stepIndex: i,
      instruction,
      status: "pending",
      retryCount: 0,
    }));
    this.state.currentStepIndex = 0;
    logger.info(`Loaded ${instructions.length} steps.`);
  }

  public markStepRunning(): void {
    const step = this.getCurrentStep();
    if (!step) return;
    step.status = "running";
    logger.debug(`Step ${step.stepIndex + 1}/${this.state.steps.length} running: "${step.instruction}"`);
  }

  public markStepSuccess(result: AgentStep["result"]): void {
    const step = this.getCurrentStep();
    if (!step) return;
    step.status = "success";
    step.result = result;
    logger.info(`✅ Step ${step.stepIndex + 1} succeeded.`);
    this.advance();
  }

  public markStepRetrying(error: string, revisedInstruction?: string): void {
    const step = this.getCurrentStep();
    if (!step) return;
    step.status = "retrying";
    step.error = error;
    step.retryCount += 1;
    if (revisedInstruction) {
      logger.info(`Step ${step.stepIndex + 1} revised: "${revisedInstruction}"`);
      step.instruction = revisedInstruction;
    }
    logger.warn(`🔄 Step ${step.stepIndex + 1} retrying (attempt ${step.retryCount}).`);
  }

  public markStepFailed(error: string): void {
    const step = this.getCurrentStep();
    if (!step) return;
    step.status = "failed";
    step.error = error;
    this.state.hasFailed = true;
    logger.error(`❌ Step ${step.stepIndex + 1} permanently failed: ${error}`);
  }

  private advance(): void {
    const nextIndex = this.state.currentStepIndex + 1;
    if (nextIndex >= this.state.steps.length) {
      this.state.isComplete = true;
      logger.info("🏁 All steps completed successfully.");
    } else {
      this.state.currentStepIndex = nextIndex;
    }
  }


  public getSummary(): string {
    const { steps, isComplete, hasFailed } = this.state;
    const succeeded = steps.filter((s) => s.status === "success").length;
    const failed = steps.filter((s) => s.status === "failed").length;
    const status = isComplete ? "PASSED" : hasFailed ? "FAILED" : "INCOMPLETE";

    return [
      `\n${"=".repeat(50)}`,
      ` TEST SESSION SUMMARY`,
      `${"=".repeat(50)}`,
      ` Goal:   ${this.state.goal}`,
      ` Status: ${status}`,
      ` Steps:  ${succeeded}/${steps.length} succeeded, ${failed} failed`,
      `${"=".repeat(50)}`,
      ...steps.map((s, i) => {
        const icon = s.status === "success" ? "✅" : s.status === "failed" ? "❌" : "⏭";
        const retries = s.retryCount > 0 ? ` (${s.retryCount} retries)` : "";
        return ` ${icon} ${i + 1}. ${s.instruction}${retries}`;
      }),
      `${"=".repeat(50)}\n`,
    ].join("\n");
  }
}
