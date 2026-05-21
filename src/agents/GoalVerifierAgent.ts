import { LlmClient } from "../utils/LlmClient";
import { Logger } from "../utils/Logger";
import { aomToPromptString } from "../utils/AomExtractor";
import type { AomSnapshot } from "../utils/AomExtractor";
import type {
  AdaptiveHistoryEntry,
  GoalInput,
  GoalVerificationOutput,
} from "../core/types";

const logger = new Logger("GoalVerifierAgent");

const SYSTEM_PROMPT = `You are a strict browser test goal verifier.

Your job:
Given the original high-level goal, structured test data, current page state, and action history, decide whether the goal is actually complete.

## Rules
- Be strict. Do not mark complete just because actions were attempted.
- Prefer visible UI evidence, success messages, form values, created records, or stable URL/page state.
- If the appointment data is visible or a clear success message says creation succeeded, completion can be high confidence.
- If evidence is weak but the latest action likely submitted the form, use medium confidence and list missing evidence.
- If login failed, validation errors are visible, required fields are empty, or the appointment is not submitted, isComplete must be false.

## Response format
Respond ONLY with valid JSON. Do not include markdown, explanations before/after JSON, or <think> blocks:
{
  "isComplete": true | false,
  "confidence": "low" | "medium" | "high",
  "missing": ["Remaining evidence or actions needed"],
  "reasoning": "Brief evidence-based explanation"
}`;

export interface GoalVerifierInput {
  goal: GoalInput;
  snapshot: AomSnapshot;
  history: AdaptiveHistoryEntry[];
}

export class GoalVerifierAgent {
  private readonly llm: LlmClient;

  constructor() {
    this.llm = new LlmClient();
  }

  public async verify(input: GoalVerifierInput): Promise<GoalVerificationOutput> {
    logger.info("Verifying high-level goal");

    const response = await this.llm.complete(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: this.buildUserMessage(input) },
      ],
      2048
    );

    const output = LlmClient.parseJsonResponse<GoalVerificationOutput>(
      response.content
    );
    this.validateOutput(output);

    logger.info(`Goal complete: ${output.isComplete}`, {
      confidence: output.confidence,
      missing: output.missing,
      reasoning: output.reasoning,
    });

    return output;
  }

  private buildUserMessage(input: GoalVerifierInput): string {
    return [
      `## Goal`,
      input.goal.goal,
      ``,
      `## Structured Test Data`,
      JSON.stringify(input.goal.testData ?? {}, null, 2),
      ``,
      input.goal.context ? `## Extra Context\n${input.goal.context}\n` : "",
      `## Current Page State`,
      aomToPromptString(input.snapshot),
      ``,
      `## Execution History`,
      JSON.stringify(input.history.slice(-16), null, 2),
    ]
      .filter((part) => part.length > 0)
      .join("\n");
  }

  private validateOutput(output: GoalVerificationOutput): void {
    if (!output || typeof output !== "object") {
      throw new Error("Goal verifier returned invalid empty output");
    }

    if (typeof output.isComplete !== "boolean") {
      throw new Error("Goal verifier output is missing boolean isComplete");
    }

    if (!["low", "medium", "high"].includes(output.confidence)) {
      throw new Error(`Goal verifier returned invalid confidence: ${output.confidence}`);
    }

    if (!Array.isArray(output.missing)) {
      throw new Error("Goal verifier output is missing missing[]");
    }

    if (!output.reasoning?.trim()) {
      throw new Error("Goal verifier output is missing reasoning");
    }
  }
}
