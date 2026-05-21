"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpObserverAgent = void 0;
const LlmClient_1 = require("../../../utils/LlmClient");
const Logger_1 = require("../../../utils/Logger");
const McpMultiAgentState_1 = require("../core/McpMultiAgentState");
const logger = new Logger_1.Logger("McpObserverAgent");
const SYSTEM_PROMPT = `You are the ObserverAgent for Playwright MCP.

Your job is to decide which observation tool is needed before planning or acting.

Rules:
- Prefer browser_snapshot for normal UI perception.
- Use browser_take_screenshot only when accessibility snapshot is ambiguous.
- Use browser_console_messages or browser_network_requests only when errors suggest it.
- Use only available tool names.
- Do not repeat browser_snapshot forever if the latest snapshot is already available and actionable.

Return ONLY valid JSON:
{
  "shouldObserve": true,
  "toolName": "browser_snapshot",
  "arguments": {},
  "reasoning": "brief reason"
}`;
class McpObserverAgent {
    llm = new LlmClient_1.LlmClient();
    async decide(state) {
        logger.info("Choosing MCP observation tool");
        if (state.observations.length === 0) {
            return this.defaultSnapshot("Need initial page snapshot.");
        }
        if (state.lastError && /console|network|request/i.test(state.lastError)) {
            const networkTool = state.tools.find((tool) => tool.name === "browser_network_requests");
            if (networkTool) {
                return {
                    shouldObserve: true,
                    toolName: networkTool.name,
                    arguments: {},
                    reasoning: "Last error suggests network state may explain the failure.",
                };
            }
        }
        const response = await this.llm.complete([
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: this.buildUserMessage(state) },
        ], 1536);
        const decision = this.normalize(LlmClient_1.LlmClient.parseJsonResponse(response.content), state);
        logger.info(`Observer selected: ${decision.toolName}`, decision);
        return decision;
    }
    buildUserMessage(state) {
        return [
            `## Current Subgoal`,
            state.currentSubgoal ?? "No subgoal yet",
            ``,
            `## Last Error`,
            state.lastError ?? "None",
            ``,
            `## Consecutive Snapshots`,
            String(state.consecutiveSnapshots),
            ``,
            `## Available Tools`,
            JSON.stringify((0, McpMultiAgentState_1.compactTools)(state.tools), null, 2),
            ``,
            `## Recent Observations`,
            JSON.stringify((0, McpMultiAgentState_1.compactObservations)(state.observations), null, 2),
            ``,
            `Choose the best observation tool.`,
        ].join("\n");
    }
    normalize(raw, state) {
        const fallback = this.defaultSnapshot("Fallback to browser_snapshot.");
        const toolName = raw.toolName?.trim() || fallback.toolName;
        if (!(0, McpMultiAgentState_1.toolExists)(state.tools, toolName)) {
            return fallback;
        }
        return {
            shouldObserve: raw.shouldObserve !== false,
            toolName,
            arguments: raw.arguments && typeof raw.arguments === "object" ? raw.arguments : {},
            reasoning: raw.reasoning?.trim() ||
                `Observer returned no reasoning; using ${toolName}.`,
        };
    }
    defaultSnapshot(reasoning) {
        return {
            shouldObserve: true,
            toolName: "browser_snapshot",
            arguments: {},
            reasoning,
        };
    }
}
exports.McpObserverAgent = McpObserverAgent;
