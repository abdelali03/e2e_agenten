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
        if (state.consecutiveSnapshots >= 2 &&
            !state.latestVisualAnalysis &&
            !this.recentlyTriedVision(state)) {
            return {
                route: "vision",
                reasoning: "The workflow observed repeatedly without progress. Use screenshot vision to understand the visible UI state before retrying.",
            };
        }
        if (state.consecutiveSnapshots >= 3) {
            return {
                route: "retryAnalyze",
                reasoning: "The workflow has observed repeatedly. The latest snapshot should be used for an action now.",
            };
        }
        if (state.retryCount >= 2 &&
            !state.latestVisualAnalysis &&
            !this.recentlyTriedVision(state)) {
            return {
                route: "vision",
                reasoning: "Two consecutive tool failures occurred. Use screenshot vision to understand the visible UI state before retrying.",
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
    recentlyTriedVision(state) {
        return state.observations
            .slice(-4)
            .some((entry) => entry.phase === "vision" || entry.agentName === "VisionTool");
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
            JSON.stringify((0, McpMultiAgentState_1.compactObservations)(state.observations), null, 2),
            ``,
            `Choose the recovery route.`,
        ].join("\n");
    }
    normalize(raw) {
        const allowed = ["retryAnalyze", "observe", "vision", "plan", "verify", "blocked"];
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
