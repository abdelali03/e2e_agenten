import type { GoalInput } from "../../../core/types";
import type { McpToolInfo } from "../../../utils/PlaywrightMcpClient";

export type McpMultiAgentStatus = "running" | "passed" | "failed" | "blocked";

export interface McpToolCallProposal {
  toolName: string;
  arguments: Record<string, unknown>;
  elementDescription?: string;
  reasoning: string;
}

export interface McpObservationEntry {
  index: number;
  phase:
    | "init"
    | "observe"
    | "plan"
    | "analyze"
    | "execute"
    | "critic"
    | "verify";
  agentName: string;
  toolName?: string;
  arguments?: Record<string, unknown>;
  success: boolean;
  resultText: string;
  errorMessage?: string;
  reasoning?: string;
}

export interface McpPlanDecision {
  status: "continue" | "complete" | "blocked";
  subgoal?: string;
  expectedOutcome?: string;
  reasoning: string;
}

export interface McpObservationDecision {
  shouldObserve: boolean;
  toolName: string;
  arguments: Record<string, unknown>;
  reasoning: string;
}

export interface McpCriticDecision {
  route: "retryAnalyze" | "observe" | "plan" | "verify" | "blocked";
  revisedSubgoal?: string;
  reasoning: string;
}

export interface McpVerificationDecision {
  isComplete: boolean;
  confidence: "low" | "medium" | "high";
  route: "complete" | "continue" | "blocked";
  evidence: string[];
  missing: string[];
  reasoning: string;
}

export interface McpMultiAgentState {
  goal: GoalInput;
  tools: McpToolInfo[];
  observations: McpObservationEntry[];
  status: McpMultiAgentStatus;
  currentSubgoal?: string;
  expectedOutcome?: string;
  plan?: McpPlanDecision;
  observationDecision?: McpObservationDecision;
  proposedToolCall?: McpToolCallProposal;
  criticDecision?: McpCriticDecision;
  verification?: McpVerificationDecision;
  lastError?: string;
  finalSummary?: string;
  iteration: number;
  toolCallCount: number;
  retryCount: number;
  consecutiveSnapshots: number;
  maxToolCalls: number;
}

export function compactTools(tools: McpToolInfo[]): unknown[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));
}

export function compactObservations(
  observations: McpObservationEntry[],
  latestMax = 12_000,
  olderMax = 1_800
): unknown[] {
  const recent = observations.slice(-10);

  return recent.map((entry, index) => {
    const isLatest = index === recent.length - 1;
    const max = isLatest ? latestMax : olderMax;

    return {
      index: entry.index,
      phase: entry.phase,
      agentName: entry.agentName,
      toolName: entry.toolName,
      arguments: entry.arguments,
      success: entry.success,
      errorMessage: entry.errorMessage,
      reasoning: entry.reasoning,
      resultText: entry.resultText.slice(0, max),
    };
  });
}

export function appendObservation(
  state: McpMultiAgentState,
  entry: Omit<McpObservationEntry, "index">
): McpObservationEntry[] {
  return [
    ...state.observations,
    {
      ...entry,
      index: state.observations.length + 1,
    },
  ];
}

export function toolExists(tools: McpToolInfo[], toolName: string): boolean {
  return tools.some((tool) => tool.name === toolName);
}
