"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllLlmMcpAgent = void 0;
const LlmClient_1 = require("../../../utils/LlmClient");
const Logger_1 = require("../../../utils/Logger");
const logger = new Logger_1.Logger("AllLlmMcpAgent");
const SYSTEM_PROMPT = `You are an autonomous browser agent using Playwright MCP.

You do not delegate clicks or fills to a separate executor agent.
You directly choose the next Playwright MCP tool to call and provide its arguments.

Internally act as four roles, but return one JSON object only:
- Planner: infer the next subgoal from the overall goal and current MCP observations.
- DOM Analyst: read the latest MCP accessibility snapshot and identify exact element refs like e12/e19.
- Executor: choose the exact MCP tool and arguments.
- Critic: inspect previous failures/repetition and recover with a different tool or arguments.

## Operating model
- You receive the list of MCP tools exposed by the Playwright MCP server.
- You receive previous MCP tool results, including accessibility snapshots.
- Choose exactly one next MCP tool call, or mark the workflow complete/blocked.
- Use MCP snapshots and observations as your current page state.
- Prefer accessibility/snapshot-based tools over screenshots unless visual ambiguity requires otherwise.
- Use the actual tool names and argument shapes from the tool list. Do not invent tool names.
- Navigate to the start URL using the available navigation tool.
- After navigation and after meaningful actions, use browser_snapshot to inspect the page before deciding the next interaction.
- Do not call browser_snapshot repeatedly if the latest snapshot already shows actionable elements. Take action.
- If a tool call fails, recover by choosing another MCP tool or different arguments.
- Mark complete only when the latest observations visibly prove the goal is achieved.
- Use browser_fill_form when multiple form fields are visible and their element refs are clear.
- Use browser_click with {"element":"human readable element","target":"eNN"} when a snapshot exposes an element ref.
- Use browser_type or browser_press_key for complex widgets when fill_form is not suitable.
- Avoid browser_run_code_unsafe unless there is no normal MCP interaction path.

## Response
Return ONLY valid JSON:
{
  "status": "callTool" | "complete" | "blocked",
  "toolName": "exact MCP tool name to call",
  "arguments": { "key": "value according to the tool schema" },
  "currentState": "brief state summary",
  "nextSubgoal": "brief next subgoal",
  "reasoning": "brief reason grounded in observations",
  "finalSummary": "only for complete or blocked"
}`;
class AllLlmMcpAgent {
    llm;
    constructor() {
        this.llm = new LlmClient_1.LlmClient();
    }
    async decide(input) {
        logger.info("All-LLM MCP agent deciding next tool call");
        const response = await this.llm.complete([
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: this.buildUserMessage(input) },
        ], 4096);
        logger.debug("All-LLM MCP raw response:", response.content);
        const decision = this.normalizeDecision(LlmClient_1.LlmClient.parseJsonResponse(response.content));
        this.validate(decision, input.tools);
        logger.info(`All-LLM MCP decision: ${decision.status}`, {
            toolName: decision.toolName,
            arguments: decision.arguments,
            reasoning: decision.reasoning,
        });
        return decision;
    }
    buildUserMessage(input) {
        return [
            `## Goal`,
            input.goal.goal,
            ``,
            `## Start URL`,
            input.goal.url,
            ``,
            `## Structured Test Data`,
            JSON.stringify(input.goal.testData ?? {}, null, 2),
            ``,
            input.goal.context ? `## Extra Context\n${input.goal.context}\n` : "",
            `## Available Playwright MCP Tools`,
            JSON.stringify(this.compactTools(input.tools), null, 2),
            ``,
            `## Recent MCP Observations`,
            JSON.stringify(this.compactObservations(input.observations), null, 2),
            ``,
            input.lastError ? `## Last Error\n${input.lastError}\n` : "",
            `Choose the next MCP tool call.`,
        ]
            .filter((part) => part.length > 0)
            .join("\n");
    }
    compactTools(tools) {
        return tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
        }));
    }
    compactObservations(observations) {
        const recent = observations.slice(-8);
        return recent.map((entry, index) => {
            const isLatest = index === recent.length - 1;
            const maxTextLength = isLatest ? 12_000 : 1_500;
            return {
                index: entry.index,
                toolName: entry.toolName,
                arguments: entry.arguments,
                success: entry.success,
                errorMessage: entry.errorMessage,
                resultText: entry.resultText.slice(0, maxTextLength),
            };
        });
    }
    normalizeDecision(raw) {
        const decision = raw;
        if (!decision.status) {
            decision.status = decision.toolName ? "callTool" : "blocked";
        }
        if (!decision.arguments || typeof decision.arguments !== "object") {
            decision.arguments = {};
        }
        if (!decision.reasoning?.trim()) {
            decision.reasoning = [
                decision.currentState,
                decision.nextSubgoal,
                decision.toolName ? `Calling ${decision.toolName}.` : "",
            ]
                .filter(Boolean)
                .join(" ");
        }
        if (!decision.reasoning?.trim()) {
            decision.reasoning = `No reasoning returned by model for status="${decision.status}".`;
        }
        return decision;
    }
    validate(decision, tools) {
        if (!decision || typeof decision !== "object") {
            throw new Error("AllLlmMcpAgent returned invalid empty decision");
        }
        if (!["callTool", "complete", "blocked"].includes(decision.status)) {
            throw new Error(`Invalid MCP agent status: ${decision.status}`);
        }
        if (decision.status !== "callTool") {
            return;
        }
        if (!decision.toolName?.trim()) {
            throw new Error("MCP agent tool call is missing toolName");
        }
        if (!tools.some((tool) => tool.name === decision.toolName)) {
            throw new Error(`MCP agent invented unknown tool: ${decision.toolName}`);
        }
        if (!decision.arguments || typeof decision.arguments !== "object") {
            decision.arguments = {};
        }
    }
}
exports.AllLlmMcpAgent = AllLlmMcpAgent;
