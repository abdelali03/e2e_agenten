import { LlmClient } from "../../../utils/LlmClient";
import { Logger } from "../../../utils/Logger";
import {
  compactObservations,
  compactTools,
  toolExists,
  type McpMultiAgentState,
  type McpObservationDecision,
} from "../core/McpMultiAgentState";

const logger = new Logger("McpObserverAgent");

const SYSTEM_PROMPT = `You are the ObserverAgent for Playwright MCP.

Your job is to decide which observation tool is needed before planning or acting.

Rules:
- Prefer browser_snapshot for normal UI perception.
- Use browser_take_screenshot only when accessibility snapshot is ambiguous.
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

export class McpObserverAgent {
  private readonly llm = new LlmClient();

  public async decide(state: McpMultiAgentState): Promise<McpObservationDecision> {
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

    const response = await this.llm.complete(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: this.buildUserMessage(state) },
      ],
      1536
    );

    const decision = this.normalize(
      LlmClient.parseJsonResponse<Partial<McpObservationDecision>>(response.content),
      state
    );

    logger.info(`Observer selected: ${decision.toolName}`, decision);
    return decision;
  }

  private buildUserMessage(state: McpMultiAgentState): string {
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
      JSON.stringify(compactTools(state.tools), null, 2),
      ``,
      `## Recent Observations`,
      JSON.stringify(compactObservations(state.observations), null, 2),
      ``,
      `Choose the best observation tool.`,
    ].join("\n");
  }

  private normalize(
    raw: Partial<McpObservationDecision>,
    state: McpMultiAgentState
  ): McpObservationDecision {
    const fallback = this.defaultSnapshot("Fallback to browser_snapshot.");
    const toolName = raw.toolName?.trim() || fallback.toolName;
    const allowedObservationTools = new Set([
      "browser_snapshot",
      "browser_take_screenshot",
      "browser_console_messages",
      "browser_network_requests",
      "browser_network_request",
    ]);

    if (!toolExists(state.tools, toolName) || !allowedObservationTools.has(toolName)) {
      return fallback;
    }

    return {
      shouldObserve: true,
      toolName,
      arguments:
        raw.arguments && typeof raw.arguments === "object" ? raw.arguments : {},
      reasoning:
        raw.reasoning?.trim() ||
        `Observer returned no reasoning; using ${toolName}.`,
    };
  }

  private defaultSnapshot(reasoning: string): McpObservationDecision {
    return {
      shouldObserve: true,
      toolName: "browser_snapshot",
      arguments: {},
      reasoning,
    };
  }
}
