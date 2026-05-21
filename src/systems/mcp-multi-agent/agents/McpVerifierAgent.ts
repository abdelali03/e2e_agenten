import { LlmClient } from "../../../utils/LlmClient";
import { Logger } from "../../../utils/Logger";
import {
  compactObservations,
  type McpMultiAgentState,
  type McpVerificationDecision,
} from "../core/McpMultiAgentState";

const logger = new Logger("McpVerifierAgent");

const SYSTEM_PROMPT = `You are the VerifierAgent for a Playwright MCP multi-agent browser workflow.

Your job:
Decide whether the original user goal is actually complete using current MCP observations and history.

Rules:
- Be strict. Do not mark complete only because a tool succeeded.
- Prefer visible evidence in snapshots: success toast, created record, final page state, target text/value.
- If evidence is weak, route "continue".
- If the app blocks progress or required data is missing, route "blocked".

Return ONLY valid JSON:
{
  "isComplete": true,
  "confidence": "low" | "medium" | "high",
  "route": "complete" | "continue" | "blocked",
  "evidence": ["visible proof"],
  "missing": ["missing evidence/actions"],
  "reasoning": "brief evidence-based explanation"
}`;

export class McpVerifierAgent {
  private readonly llm = new LlmClient();

  public async verify(state: McpMultiAgentState): Promise<McpVerificationDecision> {
    logger.info("Verifying MCP multi-agent goal");

    const response = await this.llm.complete(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: this.buildUserMessage(state) },
      ],
      2048
    );

    const decision = this.normalize(
      LlmClient.parseJsonResponse<Partial<McpVerificationDecision>>(
        response.content
      )
    );

    logger.info(`Verifier route: ${decision.route}`, decision);
    return decision;
  }

  private buildUserMessage(state: McpMultiAgentState): string {
    return [
      `## Goal`,
      state.goal.goal,
      ``,
      `## Structured Test Data`,
      JSON.stringify(state.goal.testData ?? {}, null, 2),
      ``,
      `## Current Subgoal`,
      state.currentSubgoal ?? "None",
      ``,
      `## Expected Outcome`,
      state.expectedOutcome ?? "None",
      ``,
      `## Recent Observations`,
      JSON.stringify(compactObservations(state.observations, 14_000, 2_000), null, 2),
      ``,
      `Decide whether the full goal is complete.`,
    ].join("\n");
  }

  private normalize(raw: Partial<McpVerificationDecision>): McpVerificationDecision {
    const confidence = ["low", "medium", "high"].includes(raw.confidence ?? "")
      ? raw.confidence!
      : "low";

    const isComplete = Boolean(raw.isComplete);
    const route =
      raw.route && ["complete", "continue", "blocked"].includes(raw.route)
        ? raw.route
        : isComplete && confidence !== "low"
        ? "complete"
        : "continue";

    return {
      isComplete,
      confidence,
      route,
      evidence: Array.isArray(raw.evidence) ? raw.evidence : [],
      missing: Array.isArray(raw.missing) ? raw.missing : [],
      reasoning:
        raw.reasoning?.trim() ||
        `Verifier returned no reasoning; route=${route}.`,
    };
  }
}
