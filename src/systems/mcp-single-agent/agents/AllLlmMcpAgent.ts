import { LlmClient } from "../../../utils/LlmClient";
import { Logger } from "../../../utils/Logger";
import type { GoalInput } from "../../../core/types";
import type { McpToolInfo } from "../../../utils/PlaywrightMcpClient";

const logger = new Logger("AllLlmMcpAgent");

export interface McpObservationEntry {
  index: number;
  toolName: string;
  arguments: Record<string, unknown>;
  success: boolean;
  resultText: string;
  errorMessage?: string;
}

export interface McpAgentDecision {
  status: "callTool" | "complete" | "blocked";
  toolName?: string;
  arguments?: Record<string, unknown>;
  reasoning?: string;
  finalSummary?: string;
  currentState?: string;
  nextSubgoal?: string;
}

export interface AllLlmMcpAgentInput {
  goal: GoalInput;
  tools: McpToolInfo[];
  observations: McpObservationEntry[];
  actionMemory?: string;
  lastError?: string;
}

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
- browser_snapshot observations are enhanced with generic UI context: visible text, active element, dialogs, overlays, forms, fields, menus, tables, validation errors, component hints, layout, and accessibility warnings.
- Prefer accessibility/snapshot-based tools over screenshots unless visual ambiguity requires otherwise.
- If a VisionTool analysis appears in observations, use it to understand visible UI components, layout, blockers, validation errors, and custom widgets.
- VisionTool analysis does not provide MCP element refs. Use actual refs from browser_snapshot for clicks/fills.
- Durable Workflow Memory summarizes successful previous actions and goal progress across the full run. Treat it as source of truth unless a later observation clearly disproves it.
- Never reset already completed substeps because a low-confidence vision result is incomplete. If title/description/date/color/etc. were successfully filled or selected earlier, continue from the remaining missing work.
- If a dialog, modal, popover, drawer, or overlay blocks a background click, interact with the visible blocking UI instead of clicking behind it. Do not press Escape/Back to close a partially completed form unless closing is required or there is no safe path inside the dialog.
- After a successful vision_analysis, treat it as recovery context for action. You may request at most one fresh full-page browser_snapshot to find missing refs, then you must choose an interaction tool instead of repeating snapshots.
- If snapshots do not expose the visually identified target, use robust MCP-supported selectors such as role/name or text selectors when appropriate. Do not stay in a snapshot loop.
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

export class AllLlmMcpAgent {
  private readonly llm: LlmClient;

  constructor() {
    this.llm = new LlmClient();
  }

  public async decide(input: AllLlmMcpAgentInput): Promise<McpAgentDecision> {
    logger.info("All-LLM MCP agent deciding next tool call");

    const response = await this.llm.complete(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: this.buildUserMessage(input) },
      ],
      4096
    );

    logger.debug("All-LLM MCP raw response:", response.content);

    const decision = this.normalizeDecision(
      LlmClient.parseJsonResponse<Partial<McpAgentDecision>>(response.content)
    );
    this.validate(decision, input.tools);

    logger.info(`All-LLM MCP decision: ${decision.status}`, {
      toolName: decision.toolName,
      arguments: decision.arguments,
      reasoning: decision.reasoning,
    });

    return decision;
  }

  private buildUserMessage(input: AllLlmMcpAgentInput): string {
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
      input.actionMemory ? `## Durable Workflow Memory\n${input.actionMemory}\n` : "",
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

  private compactTools(tools: McpToolInfo[]): unknown[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));
  }

  private compactObservations(observations: McpObservationEntry[]): unknown[] {
    const recent = observations.slice(-8);

    return recent.map((entry, index) => {
      const isLatest = index === recent.length - 1;
      const maxTextLength = isLatest ? 20_000 : 2_000;

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

  private normalizeDecision(raw: Partial<McpAgentDecision>): McpAgentDecision {
    const decision = raw as McpAgentDecision;

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

  private validate(decision: McpAgentDecision, tools: McpToolInfo[]): void {
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
