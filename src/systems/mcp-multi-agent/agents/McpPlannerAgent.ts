import { LlmClient } from "../../../utils/LlmClient";
import { Logger } from "../../../utils/Logger";
import {
  compactObservations,
  type McpMultiAgentState,
  type McpPlanDecision,
} from "../core/McpMultiAgentState";

const logger = new Logger("McpPlannerAgent");

const SYSTEM_PROMPT = `You are the PlannerAgent in a multi-agent browser automation system.

Your job is to decide the next subgoal, not the exact MCP element ref or tool call.

Rules:
- Use the latest MCP observations as the source of truth.
- Continue with one small subgoal at a time.
- If the overall goal is visibly complete, return status "complete".
- If required data is missing or the UI blocks progress, return status "blocked".
- Do not invent element refs. The DOM analyst will choose concrete targets later.

Return ONLY valid JSON:
{
  "status": "continue" | "complete" | "blocked",
  "subgoal": "single next subgoal if status is continue",
  "expectedOutcome": "observable outcome after this subgoal",
  "reasoning": "brief evidence-based reason"
}`;

export class McpPlannerAgent {
  private readonly llm = new LlmClient();

  public async plan(state: McpMultiAgentState): Promise<McpPlanDecision> {
    logger.info("Planning MCP multi-agent subgoal");

    const response = await this.llm.complete(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: this.buildUserMessage(state) },
      ],
      2048
    );

    const decision = this.normalize(
      LlmClient.parseJsonResponse<Partial<McpPlanDecision>>(response.content)
    );

    logger.info(`Planner status: ${decision.status}`, decision);
    return decision;
  }

  private buildUserMessage(state: McpMultiAgentState): string {
    return [
      `## Goal`,
      state.goal.goal,
      ``,
      `## Start URL`,
      state.goal.url,
      ``,
      `## Structured Test Data`,
      JSON.stringify(state.goal.testData ?? {}, null, 2),
      ``,
      state.goal.context ? `## Extra Context\n${state.goal.context}\n` : "",
      `## Last Error`,
      state.lastError ?? "None",
      ``,
      `## Recent Observations`,
      JSON.stringify(compactObservations(state.observations), null, 2),
      ``,
      `Choose the next subgoal.`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  private normalize(raw: Partial<McpPlanDecision>): McpPlanDecision {
    const status = raw.status && ["continue", "complete", "blocked"].includes(raw.status)
      ? raw.status
      : raw.subgoal
      ? "continue"
      : "blocked";

    return {
      status,
      subgoal: raw.subgoal,
      expectedOutcome: raw.expectedOutcome,
      reasoning:
        raw.reasoning?.trim() ||
        `Planner returned no reasoning for status="${status}".`,
    };
  }
}
