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
- For browser_take_screenshot, prefer a full visible viewport screenshot. Do not crop screenshots to bare MCP refs like e123 unless the latest snapshot clearly proves that exact ref is the intended visual region; stale/over-narrow crops mislead vision.
- If repeated snapshots are not exposing the needed region, use browser_take_screenshot instead of increasing depth again.
- If an enhanced snapshot contains GENERIC PAGE MAP, use its focusedRegion/regions to target perception; do not repeatedly request deeper whole-page snapshots.
- Use browser_console_messages or browser_network_requests only when errors suggest it.
- Never choose action tools such as browser_click, browser_type, browser_fill_form, browser_press_key, browser_select_option, browser_hover, or browser_drag.
- If the next step is obvious from the latest snapshot, still return browser_snapshot only when this node is explicitly asked to observe; actions are selected by the DOM Analyst, not by the Observer.
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
        if (state.consecutiveSnapshots >= 3 &&
            (0, McpMultiAgentState_1.toolExists)(state.tools, "browser_take_screenshot")) {
            return {
                shouldObserve: true,
                toolName: "browser_take_screenshot",
                arguments: {
                    type: "png",
                    filename: `snapshot-starvation-${Date.now()}.png`,
                },
                reasoning: "Three consecutive accessibility snapshots did not expose the needed region. Use screenshot vision instead of increasing snapshot depth.",
            };
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
        const allowedObservationTools = new Set([
            "browser_snapshot",
            "browser_take_screenshot",
            "browser_console_messages",
            "browser_network_requests",
            "browser_network_request",
        ]);
        if (!(0, McpMultiAgentState_1.toolExists)(state.tools, toolName) || !allowedObservationTools.has(toolName)) {
            return fallback;
        }
        return {
            shouldObserve: true,
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
