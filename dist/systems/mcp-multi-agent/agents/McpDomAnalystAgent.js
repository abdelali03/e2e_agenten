"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpDomAnalystAgent = void 0;
const LlmClient_1 = require("../../../utils/LlmClient");
const Logger_1 = require("../../../utils/Logger");
const McpMultiAgentState_1 = require("../core/McpMultiAgentState");
const logger = new Logger_1.Logger("McpDomAnalystAgent");
const SYSTEM_PROMPT = `You are the MCP DOM Analyst and action selector.

Your job:
Given the current subgoal and latest MCP snapshot/observations, choose the exact Playwright MCP tool call that should make progress.

Rules:
- Use real element refs from browser_snapshot, such as e12 or e63.
- browser_snapshot observations are enhanced with generic UI context: visible text, active element, dialogs, overlays, forms, fields, menus, tables, validation errors, component hints, layout, and accessibility warnings.
- Use enhanced UI context to understand page state and custom components, but use MCP snapshot refs for executable targets.
- For buttons/links, usually use browser_click with {"element":"label", "target":"eNN"}.
- For multiple visible form fields, prefer browser_fill_form with fields containing target/name/type/value.
- For a single text entry, use browser_type or browser_fill_form depending on tool schema and snapshot.
- For selects, use browser_select_option.
- For keyboard-only widgets, use browser_press_key.
- If no actionable snapshot exists, request browser_snapshot.
- If a visual analysis is present, use it to understand visible components, layout, blockers, validation errors, and custom widgets.
- Do not invent element refs from visual analysis. Use actual refs from browser_snapshot for clicks/fills.
- Durable Workflow Memory summarizes successful previous actions and goal progress across the full run. Treat it as source of truth unless a later observation clearly disproves it.
- Do not reset completed substeps because a low-confidence visual analysis is incomplete.
- If a dialog/overlay blocks a background click, interact with the visible dialog/overlay instead of closing it by default.
- Use only available tool names.
- Avoid browser_run_code_unsafe unless normal MCP actions cannot work.

Return ONLY valid JSON:
{
  "toolName": "browser_click",
  "arguments": { "element": "Anmelden button", "target": "e19" },
  "elementDescription": "Anmelden button",
  "reasoning": "brief reason grounded in snapshot and subgoal"
}`;
class McpDomAnalystAgent {
    llm = new LlmClient_1.LlmClient();
    async analyze(state) {
        logger.info("Analyzing MCP snapshot for concrete tool call");
        const response = await this.llm.complete([
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: this.buildUserMessage(state) },
        ], 4096);
        const proposal = this.normalize(LlmClient_1.LlmClient.parseJsonResponse(response.content), state);
        logger.info(`DOM analyst proposed: ${proposal.toolName}`, proposal);
        return proposal;
    }
    buildUserMessage(state) {
        return [
            `## Overall Goal`,
            state.goal.goal,
            ``,
            `## Structured Test Data`,
            JSON.stringify(state.goal.testData ?? {}, null, 2),
            ``,
            `## Current Subgoal`,
            state.currentSubgoal ?? "No subgoal",
            ``,
            `## Expected Outcome`,
            state.expectedOutcome ?? "Not specified",
            ``,
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
            `## Available MCP Tools`,
            JSON.stringify((0, McpMultiAgentState_1.compactTools)(state.tools), null, 2),
            ``,
            `## Recent Observations`,
            JSON.stringify((0, McpMultiAgentState_1.compactObservations)(state.observations, 16_000, 2_000), null, 2),
            ``,
            `Choose the exact MCP tool call.`,
        ]
            .filter(Boolean)
            .join("\n");
    }
    normalize(raw, state) {
        const fallbackTool = (0, McpMultiAgentState_1.toolExists)(state.tools, "browser_snapshot")
            ? "browser_snapshot"
            : state.tools[0]?.name;
        const toolName = raw.toolName?.trim() || fallbackTool;
        if (!toolName || !(0, McpMultiAgentState_1.toolExists)(state.tools, toolName)) {
            throw new Error(`DOM analyst produced unavailable MCP tool: ${toolName}`);
        }
        return {
            toolName,
            arguments: raw.arguments && typeof raw.arguments === "object" ? raw.arguments : {},
            elementDescription: raw.elementDescription,
            reasoning: raw.reasoning?.trim() ||
                `DOM analyst returned no reasoning; using ${toolName}.`,
        };
    }
}
exports.McpDomAnalystAgent = McpDomAnalystAgent;
