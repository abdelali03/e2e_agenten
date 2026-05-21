import { LlmClient } from "../../../utils/LlmClient";
import { Logger } from "../../../utils/Logger";
import {
  compactObservations,
  type McpCriticDecision,
  type McpMultiAgentState,
} from "../core/McpMultiAgentState";

const logger = new Logger("McpCriticAgent");

const SYSTEM_PROMPT = `You are the CriticAgent for a Playwright MCP multi-agent workflow.

Your job:
Inspect recent tool failures, repeated observations, or weak progress and decide where the graph should route next.

Routes:
- retryAnalyze: same subgoal, choose a better MCP tool/target.
- observe: get a fresh snapshot or diagnostics.
- plan: current subgoal is stale; ask planner for a new subgoal.
- verify: action likely succeeded; verify overall goal.
- blocked: cannot continue.

Return ONLY valid JSON:
{
  "route": "retryAnalyze" | "observe" | "plan" | "verify" | "blocked",
  "revisedSubgoal": "optional improved subgoal",
  "reasoning": "brief reason"
}`;

export class McpCriticAgent {
  private readonly llm = new LlmClient();

  public async critique(state: McpMultiAgentState): Promise<McpCriticDecision> {
    logger.info("Critiquing MCP multi-agent progress");

    const forced = this.getForcedDecision(state);
    if (forced) {
      logger.info(`Critic forced route: ${forced.route}`, forced);
      return forced;
    }

    const response = await this.llm.complete(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: this.buildUserMessage(state) },
      ],
      2048
    );

    const decision = this.normalize(
      LlmClient.parseJsonResponse<Partial<McpCriticDecision>>(response.content)
    );

    logger.info(`Critic route: ${decision.route}`, decision);
    return decision;
  }

  private getForcedDecision(state: McpMultiAgentState): McpCriticDecision | null {
    if (state.consecutiveSnapshots >= 3) {
      return {
        route: "retryAnalyze",
        reasoning:
          "The workflow has observed repeatedly. The latest snapshot should be used for an action now.",
      };
    }

    if (state.retryCount >= 4) {
      return {
        route: "observe",
        reasoning:
          "Several retries failed. A fresh observation is needed before more actions.",
      };
    }

    return null;
  }

  private buildUserMessage(state: McpMultiAgentState): string {
    return [
      `## Goal`,
      state.goal.goal,
      ``,
      `## Current Subgoal`,
      state.currentSubgoal ?? "None",
      ``,
      `## Proposed Tool Call`,
      JSON.stringify(state.proposedToolCall ?? {}, null, 2),
      ``,
      `## Last Error`,
      state.lastError ?? "None",
      ``,
      `## Retry Count`,
      String(state.retryCount),
      ``,
      `## Consecutive Snapshots`,
      String(state.consecutiveSnapshots),
      ``,
      `## Recent Observations`,
      JSON.stringify(compactObservations(state.observations), null, 2),
      ``,
      `Choose the recovery route.`,
    ].join("\n");
  }

  private normalize(raw: Partial<McpCriticDecision>): McpCriticDecision {
    const allowed = ["retryAnalyze", "observe", "plan", "verify", "blocked"];
    const route = raw.route && allowed.includes(raw.route) ? raw.route : "observe";

    return {
      route,
      revisedSubgoal: raw.revisedSubgoal,
      reasoning:
        raw.reasoning?.trim() ||
        `Critic returned no reasoning; routing to ${route}.`,
    };
  }
}
