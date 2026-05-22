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
Use Durable Workflow Memory to preserve successful prior actions and avoid resetting the workflow after weak observations.
If a dialog/overlay blocks a background action, prefer retryAnalyze so the DOM Analyst can interact inside the blocking UI instead of closing it by default.

Routes:
- retryAnalyze: same subgoal, choose a better MCP tool/target.
- observe: get a fresh snapshot or diagnostics.
- vision: after repeated failures, inspect a screenshot visually before retrying.
- plan: current subgoal is stale; ask planner for a new subgoal.
- verify: action likely succeeded; verify overall goal.
- blocked: cannot continue.

Return ONLY valid JSON:
{
  "route": "retryAnalyze" | "observe" | "vision" | "plan" | "verify" | "blocked",
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
    if (
      state.consecutiveSnapshots >= 2 &&
      !state.latestVisualAnalysis &&
      !this.recentlyTriedVision(state)
    ) {
      return {
        route: "vision",
        reasoning:
          "The workflow observed repeatedly without progress. Use screenshot vision to understand the visible UI state before retrying.",
      };
    }

    if (state.consecutiveSnapshots >= 3) {
      return {
        route: "retryAnalyze",
        reasoning:
          "The workflow has observed repeatedly. The latest snapshot should be used for an action now.",
      };
    }

    if (
      state.retryCount >= 2 &&
      !state.latestVisualAnalysis &&
      !this.recentlyTriedVision(state)
    ) {
      return {
        route: "vision",
        reasoning:
          "Two consecutive tool failures occurred. Use screenshot vision to understand the visible UI state before retrying.",
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

  private recentlyTriedVision(state: McpMultiAgentState): boolean {
    return state.observations
      .slice(-4)
      .some((entry) => entry.phase === "vision" || entry.agentName === "VisionTool");
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
      `## Durable Workflow Memory`,
      state.workflowMemory ?? "None",
      ``,
      `## Retry Count`,
      String(state.retryCount),
      ``,
      `## Consecutive Snapshots`,
      String(state.consecutiveSnapshots),
      ``,
      `## Latest Visual Analysis`,
      state.latestVisualAnalysis
        ? JSON.stringify(state.latestVisualAnalysis, null, 2)
        : "None",
      ``,
      `## Recent Observations`,
      JSON.stringify(compactObservations(state.observations), null, 2),
      ``,
      `Choose the recovery route.`,
    ].join("\n");
  }

  private normalize(raw: Partial<McpCriticDecision>): McpCriticDecision {
    const allowed = ["retryAnalyze", "observe", "vision", "plan", "verify", "blocked"];
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
