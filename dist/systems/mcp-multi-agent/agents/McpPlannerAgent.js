"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpPlannerAgent = void 0;
const LlmClient_1 = require("../../../utils/LlmClient");
const Logger_1 = require("../../../utils/Logger");
const McpMultiAgentState_1 = require("../core/McpMultiAgentState");
const logger = new Logger_1.Logger("McpPlannerAgent");
const SYSTEM_PROMPT = `You are the PlannerAgent in a multi-agent browser automation system.

Your job is to decide the next subgoal, not the exact MCP element ref or tool call.

Rules:
- Use the latest MCP observations as the source of truth.
- browser_snapshot observations include enhanced UI context with visible dialogs, overlays, forms, fields, errors, active element, component hints, and accessibility warnings.
- Continue with one small subgoal at a time.
- If the overall goal is visibly complete, return status "complete".
- If required data is missing or the UI blocks progress, return status "blocked".
- Do not invent element refs. The DOM analyst will choose concrete targets later.
- If visual analysis is present, use it as extra context for visible blockers, dialogs, validation errors, and custom widgets.
- Use Durable Workflow Memory to preserve completed substeps. Do not re-plan already completed actions unless later evidence disproves them.
- Low-confidence or partial visual analysis must not erase successful action history.

Return ONLY valid JSON:
{
  "status": "continue" | "complete" | "blocked",
  "subgoal": "single next subgoal if status is continue",
  "expectedOutcome": "observable outcome after this subgoal",
  "reasoning": "brief evidence-based reason"
}`;
class McpPlannerAgent {
    llm = new LlmClient_1.LlmClient();
    async plan(state) {
        logger.info("Planning MCP multi-agent subgoal");
        const response = await this.llm.complete([
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: this.buildUserMessage(state) },
        ], 2048);
        const decision = this.normalize(LlmClient_1.LlmClient.parseJsonResponse(response.content));
        logger.info(`Planner status: ${decision.status}`, decision);
        return decision;
    }
    buildUserMessage(state) {
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
            `## Durable Workflow Memory`,
            state.workflowMemory ?? "None",
            ``,
            `## Latest Visual Analysis`,
            state.latestVisualAnalysis
                ? JSON.stringify(state.latestVisualAnalysis, null, 2)
                : "None",
            ``,
            `## Recent Observations`,
            JSON.stringify((0, McpMultiAgentState_1.compactObservations)(state.observations), null, 2),
            ``,
            `Choose the next subgoal.`,
        ]
            .filter(Boolean)
            .join("\n");
    }
    normalize(raw) {
        const status = raw.status && ["continue", "complete", "blocked"].includes(raw.status)
            ? raw.status
            : raw.subgoal
                ? "continue"
                : "blocked";
        return {
            status,
            subgoal: raw.subgoal,
            expectedOutcome: raw.expectedOutcome,
            reasoning: raw.reasoning?.trim() ||
                `Planner returned no reasoning for status="${status}".`,
        };
    }
}
exports.McpPlannerAgent = McpPlannerAgent;
