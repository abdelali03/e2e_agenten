"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpCriticAgent = void 0;
const LlmClient_1 = require("../../../utils/LlmClient");
const Logger_1 = require("../../../utils/Logger");
const McpMultiAgentState_1 = require("../core/McpMultiAgentState");
const logger = new Logger_1.Logger("McpCriticAgent");
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
class McpCriticAgent {
    llm = new LlmClient_1.LlmClient();
    async critique(state) {
        logger.info("Critiquing MCP multi-agent progress");
        const forced = this.getForcedDecision(state);
        if (forced) {
            logger.info(`Critic forced route: ${forced.route}`, forced);
            return forced;
        }
        const response = await this.llm.complete([
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: this.buildUserMessage(state) },
        ], 2048);
        const decision = this.normalize(LlmClient_1.LlmClient.parseJsonResponse(response.content));
        logger.info(`Critic route: ${decision.route}`, decision);
        return decision;
    }
    getForcedDecision(state) {
        if (state.consecutiveSnapshots >= 3) {
            return {
                route: "retryAnalyze",
                reasoning: "The workflow has observed repeatedly. The latest snapshot should be used for an action now.",
            };
        }
        if (state.retryCount >= 4) {
            return {
                route: "observe",
                reasoning: "Several retries failed. A fresh observation is needed before more actions.",
            };
        }
        return null;
    }
    buildUserMessage(state) {
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
            JSON.stringify((0, McpMultiAgentState_1.compactObservations)(state.observations), null, 2),
            ``,
            `Choose the recovery route.`,
        ].join("\n");
    }
    normalize(raw) {
        const allowed = ["retryAnalyze", "observe", "plan", "verify", "blocked"];
        const route = raw.route && allowed.includes(raw.route) ? raw.route : "observe";
        return {
            route,
            revisedSubgoal: raw.revisedSubgoal,
            reasoning: raw.reasoning?.trim() ||
                `Critic returned no reasoning; routing to ${route}.`,
        };
    }
}
exports.McpCriticAgent = McpCriticAgent;
