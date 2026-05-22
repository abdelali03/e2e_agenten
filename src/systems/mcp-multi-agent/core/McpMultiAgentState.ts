import type { GoalInput } from "../../../core/types";
import type { McpToolInfo } from "../../../utils/PlaywrightMcpClient";
import type { VisionToolResult } from "../../../utils/VisionTool";

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
    | "verify"
    | "vision";
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
  route: "retryAnalyze" | "observe" | "vision" | "plan" | "verify" | "blocked";
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
  latestVisualAnalysis?: VisionToolResult;
  workflowMemory?: string;
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

export function buildWorkflowMemory(state: McpMultiAgentState): string {
  const successfulActions = state.observations
    .filter(
      (entry) =>
        entry.success &&
        entry.toolName &&
        !["browser_snapshot", "browser_take_screenshot"].includes(entry.toolName) &&
        entry.phase !== "plan" &&
        entry.phase !== "analyze" &&
        entry.phase !== "critic" &&
        entry.phase !== "verify" &&
        entry.phase !== "vision"
    )
    .slice(-14)
    .map((entry) => ({
      index: entry.index,
      phase: entry.phase,
      agentName: entry.agentName,
      toolName: entry.toolName,
      arguments: compactArguments(entry.arguments),
      reasoning: entry.reasoning,
    }));

  const failedActions = state.observations
    .filter((entry) => !entry.success)
    .slice(-6)
    .map((entry) => ({
      index: entry.index,
      phase: entry.phase,
      agentName: entry.agentName,
      toolName: entry.toolName,
      arguments: compactArguments(entry.arguments),
      errorMessage: entry.errorMessage,
    }));

  const latestVision = state.latestVisualAnalysis;

  return JSON.stringify(
    {
      goal: state.goal.goal,
      currentSubgoal: state.currentSubgoal,
      expectedOutcome: state.expectedOutcome,
      successfulActions,
      failedActions,
      latestVisionGoalProgress: latestVision?.goalProgress,
      latestVisionCompletionEstimate: latestVision?.goalCompletionEstimate,
      latestVisionConfidence: latestVision?.confidence,
      latestVisionRecommendedNextAction: latestVision?.recommendedNextAction,
      retryCount: state.retryCount,
      consecutiveSnapshots: state.consecutiveSnapshots,
      lastError: state.lastError,
      memoryRules: [
        "Successful previous actions remain completed unless a later observation clearly contradicts them.",
        "Low-confidence or partial vision analysis must not erase successful action history.",
        "When a dialog/overlay blocks background clicks, continue inside the dialog/overlay instead of closing it by default.",
        "If repeated observations happen after visual recovery, choose an interaction tool or route to critic rather than requesting more snapshots.",
      ],
    },
    null,
    2
  ).slice(0, 10_000);
}

function compactArguments(
  args: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!args) {
    return undefined;
  }

  const compact: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(args)) {
    compact[key] =
      typeof value === "string" && value.length > 300
        ? `${value.slice(0, 300)}...`
        : value;
  }

  return compact;
}
