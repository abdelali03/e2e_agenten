// src/agents/CriticAgent.ts
// Schritt 4: Critic Agent (Self-Healing)
// Analysiert fehlgeschlagene Aktionen und entscheidet ob/wie ein Retry erfolgt.

import { LlmClient } from "../utils/LlmClient";
import { Logger } from "../utils/Logger";
import { aomToPromptString } from "../utils/AomExtractor";
import type { AomSnapshot } from "../utils/AomExtractor";
import { CriticInput, CriticOutput } from "../core/types";

const logger = new Logger("CriticAgent");

const MAX_RETRIES = 3;

const SYSTEM_PROMPT = `You are a critical test analyst for automated browser testing.

Your job: Analyze why a browser action failed and decide the best recovery strategy.

## Failure categories and responses
1. **Element not found** → Suggest alternative selector/description based on current DOM
2. **Element not interactable** (hidden, covered) → Suggest scroll, wait, or dismiss overlay first
3. **Timing issue** (element appeared but test was too fast) → Suggest retry with same instruction
4. **Page changed unexpectedly** → Identify new page state and revise instruction
5. **Wrong element** → Identify correct element from current DOM
6. **Unrecoverable** → Set abort: true (e.g. page crashed, required element truly missing)

## Response format
Respond ONLY with valid JSON:
{
  "shouldRetry": true | false,
  "revisedInstruction": "New instruction if the original needs to change (omit if retrying as-is)",
  "reasoning": "Brief analysis of what went wrong and why this recovery will work",
  "abort": false
}`;

export class CriticAgent {
  private readonly llm: LlmClient;

  constructor() {
    this.llm = new LlmClient();
  }

  /**
   * Bewertet einen Fehlschlag und gibt eine Retry-Empfehlung zurück.
   *
   * @param input  Fehlgeschlagene Instruktion + Fehlermeldung + aktueller DOM
   * @returns      Entscheidung: retry, revised instruction oder abort
   */
  public async evaluate(input: CriticInput): Promise<CriticOutput> {
    logger.warn(`Evaluating failure (retry ${input.retryCount}/${MAX_RETRIES}): "${input.failedInstruction}"`);
    logger.warn(`Error: ${input.errorMessage}`);

    // Hard-Limit: Nach MAX_RETRIES immer abbrechen
    if (input.retryCount >= MAX_RETRIES) {
      logger.error(`Max retries (${MAX_RETRIES}) reached – aborting step.`);
      return {
        shouldRetry: false,
        reasoning: `Maximum retry count (${MAX_RETRIES}) exceeded.`,
        abort: true,
      };
    }

    const aomContext = typeof input.aomTreeAfterFailure === "object" &&
      "nodes" in (input.aomTreeAfterFailure as object)
      ? aomToPromptString(input.aomTreeAfterFailure as unknown as AomSnapshot)
      : JSON.stringify(input.aomTreeAfterFailure, null, 2);

    const userMessage = this.buildUserMessage(input, aomContext);

    const response = await this.llm.complete(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      512
    );

    const output = LlmClient.parseJsonResponse<CriticOutput>(response.content);

    if (output.abort) {
      logger.error(`Critic decided to abort: ${output.reasoning}`);
    } else if (output.shouldRetry) {
      logger.info(`Critic recommends retry: ${output.reasoning}`);
      if (output.revisedInstruction) {
        logger.info(`Revised instruction: "${output.revisedInstruction}"`);
      }
    }

    return output;
  }

  private buildUserMessage(input: CriticInput, aomContext: string): string {
    return [
      `## Failed Instruction\n${input.failedInstruction}`,
      `## Error Message\n${input.errorMessage}`,
      `## Retry Attempt\n${input.retryCount} of ${MAX_RETRIES}`,
      `## Current Page State After Failure (AOM)\n${aomContext}`,
    ].join("\n\n");
  }
}
