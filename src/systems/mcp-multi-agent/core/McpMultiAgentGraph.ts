import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { McpPlannerAgent } from "../agents/McpPlannerAgent";
import { McpObserverAgent } from "../agents/McpObserverAgent";
import { McpDomAnalystAgent } from "../agents/McpDomAnalystAgent";
import { McpCriticAgent } from "../agents/McpCriticAgent";
import { McpVerifierAgent } from "../agents/McpVerifierAgent";
import { PlaywrightMcpClient } from "../../../utils/PlaywrightMcpClient";
import { Logger } from "../../../utils/Logger";
import { VisionTool } from "../../../utils/VisionTool";
import { EnhancedMcpSnapshotTool } from "../../../utils/EnhancedMcpSnapshotTool";
import type { GoalInput } from "../../../core/types";
import type { McpToolInfo } from "../../../utils/PlaywrightMcpClient";
import {
  appendObservation,
  buildWorkflowMemory,
  type McpCriticDecision,
  type McpMultiAgentState,
  type McpObservationDecision,
  type McpObservationEntry,
  type McpPlanDecision,
  type McpToolCallProposal,
  type McpVerificationDecision,
} from "./McpMultiAgentState";

const logger = new Logger("McpMultiAgentGraph");

const StateAnnotation = Annotation.Root({
  goal: Annotation<GoalInput>,
  tools: Annotation<McpToolInfo[]>,
  observations: Annotation<McpObservationEntry[]>,
  status: Annotation<McpMultiAgentState["status"]>,
  currentSubgoal: Annotation<string | undefined>,
  expectedOutcome: Annotation<string | undefined>,
  plan: Annotation<McpPlanDecision | undefined>,
  observationDecision: Annotation<McpObservationDecision | undefined>,
  proposedToolCall: Annotation<McpToolCallProposal | undefined>,
  criticDecision: Annotation<McpCriticDecision | undefined>,
  verification: Annotation<McpVerificationDecision | undefined>,
  latestVisualAnalysis: Annotation<McpMultiAgentState["latestVisualAnalysis"]>,
  workflowMemory: Annotation<string | undefined>,
  lastError: Annotation<string | undefined>,
  finalSummary: Annotation<string | undefined>,
  iteration: Annotation<number>,
  toolCallCount: Annotation<number>,
  retryCount: Annotation<number>,
  consecutiveSnapshots: Annotation<number>,
  maxToolCalls: Annotation<number>,
});

type GraphState = typeof StateAnnotation.State;
type GraphUpdate = Partial<GraphState>;

export interface McpMultiAgentGraphDeps {
  mcp: PlaywrightMcpClient;
  planner: McpPlannerAgent;
  observer: McpObserverAgent;
  analyst: McpDomAnalystAgent;
  critic: McpCriticAgent;
  verifier: McpVerifierAgent;
  visionTool: VisionTool;
  enhancedSnapshotTool: EnhancedMcpSnapshotTool;
}

export function buildMcpMultiAgentGraph(deps: McpMultiAgentGraphDeps) {
  const connectMcp = async (state: GraphState): Promise<GraphUpdate> => {
    await deps.mcp.connect();
    const tools = await deps.mcp.listTools();

    logger.info("MCP multi-agent tools available", {
      tools: tools.map((tool) => tool.name),
    });

    return {
      tools,
      observations: appendObservation(state, {
        phase: "init",
        agentName: "McpMultiAgentGraph",
        success: true,
        resultText: `Connected to Playwright MCP. Tools: ${tools
          .map((tool) => tool.name)
          .join(", ")}`,
      }),
    };
  };

  const navigateStart = async (state: GraphState): Promise<GraphUpdate> => {
    const toolName = "browser_navigate";
    const args = { url: state.goal.url };
    const result = await callMcpTool(
      state,
      deps,
      "init",
      "Navigator",
      toolName,
      args
    );

    return withWorkflowMemory(state, {
      observations: result.observations,
      toolCallCount: state.toolCallCount + 1,
      consecutiveSnapshots: 0,
      lastError: result.lastError,
    });
  };

  const observeForPlanning = async (state: GraphState): Promise<GraphUpdate> => {
    return observe(state, deps, "observe");
  };

  const plan = async (state: GraphState): Promise<GraphUpdate> => {
    if (exceededToolBudget(state)) {
      return failForBudget(state);
    }

    const decision = await deps.planner.plan(state);

    if (decision.status === "complete") {
      return {
        status: "passed",
        plan: decision,
        finalSummary: decision.reasoning,
      };
    }

    if (decision.status === "blocked") {
      return {
        status: "blocked",
        plan: decision,
        finalSummary: decision.reasoning,
        lastError: decision.reasoning,
      };
    }

    return withWorkflowMemory(state, {
      plan: decision,
      currentSubgoal: decision.subgoal,
      expectedOutcome: decision.expectedOutcome,
      lastError: undefined,
      observations: appendObservation(state, {
        phase: "plan",
        agentName: "McpPlannerAgent",
        success: true,
        resultText: decision.subgoal ?? "",
        reasoning: decision.reasoning,
      }),
    });
  };

  const analyze = async (state: GraphState): Promise<GraphUpdate> => {
    try {
      const proposal = await deps.analyst.analyze(state);

      return withWorkflowMemory(state, {
        proposedToolCall: proposal,
        observations: appendObservation(state, {
          phase: "analyze",
          agentName: "McpDomAnalystAgent",
          toolName: proposal.toolName,
          arguments: proposal.arguments,
          success: true,
          resultText: proposal.elementDescription ?? proposal.toolName,
          reasoning: proposal.reasoning,
        }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return withWorkflowMemory(state, {
        lastError: message,
        observations: appendObservation(state, {
          phase: "analyze",
          agentName: "McpDomAnalystAgent",
          success: false,
          resultText: "",
          errorMessage: message,
        }),
      });
    }
  };

  const executeTool = async (state: GraphState): Promise<GraphUpdate> => {
    if (exceededToolBudget(state)) {
      return failForBudget(state);
    }

    const proposal = state.proposedToolCall;
    if (!proposal) {
      const error = "No proposed MCP tool call to execute.";
      return withWorkflowMemory(state, {
        lastError: error,
        observations: appendObservation(state, {
          phase: "execute",
          agentName: "McpToolExecutor",
          success: false,
          resultText: "",
          errorMessage: error,
        }),
      });
    }

    const result = await callMcpTool(
      state,
      deps,
      "execute",
      "McpToolExecutor",
      proposal.toolName,
      proposal.arguments,
      proposal.reasoning
    );

    return withWorkflowMemory(state, {
      observations: result.observations,
      toolCallCount: state.toolCallCount + 1,
      retryCount: result.lastError ? state.retryCount + 1 : 0,
      consecutiveSnapshots:
        proposal.toolName === "browser_snapshot" && !result.lastError
          ? state.consecutiveSnapshots + 1
          : 0,
      lastError: result.lastError,
    });
  };

  const observeAfterAction = async (state: GraphState): Promise<GraphUpdate> => {
    return observe(state, deps, "verify");
  };

  const verify = async (state: GraphState): Promise<GraphUpdate> => {
    const decision = await deps.verifier.verify(state);

    if (decision.route === "complete" && decision.confidence !== "low") {
      return {
        status: "passed",
        verification: decision,
        finalSummary: decision.reasoning,
      };
    }

    if (decision.route === "blocked") {
      return {
        status: "blocked",
        verification: decision,
        finalSummary: decision.reasoning,
        lastError: decision.reasoning,
      };
    }

    return withWorkflowMemory(state, {
      verification: decision,
      observations: appendObservation(state, {
        phase: "verify",
        agentName: "McpVerifierAgent",
        success: true,
        resultText: JSON.stringify({
          complete: decision.isComplete,
          confidence: decision.confidence,
          missing: decision.missing,
        }),
        reasoning: decision.reasoning,
      }),
    });
  };

  const critique = async (state: GraphState): Promise<GraphUpdate> => {
    const decision = await deps.critic.critique(state);

    return withWorkflowMemory(state, {
      criticDecision: decision,
      currentSubgoal: decision.revisedSubgoal ?? state.currentSubgoal,
      lastError: decision.route === "blocked" ? decision.reasoning : state.lastError,
      status: decision.route === "blocked" ? "blocked" : state.status,
      finalSummary:
        decision.route === "blocked" ? decision.reasoning : state.finalSummary,
      observations: appendObservation(state, {
        phase: "critic",
        agentName: "McpCriticAgent",
        success: decision.route !== "blocked",
        resultText: decision.route,
        reasoning: decision.reasoning,
      }),
    });
  };

  const analyzeVision = async (state: GraphState): Promise<GraphUpdate> => {
    const analysis = await deps.visionTool.analyzeCurrentPage(deps.mcp, {
      goal: state.goal.goal,
      currentSubgoal: state.currentSubgoal,
      expectedOutcome: state.expectedOutcome,
      lastError: state.lastError,
      recentFailures: getRecentFailureMessages(state),
      recentObservations: state.observations
        .slice(-4)
        .map((entry) =>
          [
            `[${entry.phase}] ${entry.agentName}`,
            entry.toolName ? `tool=${entry.toolName}` : "",
            entry.errorMessage ? `error=${entry.errorMessage}` : "",
            entry.resultText ? `result=${entry.resultText.slice(0, 500)}` : "",
          ]
            .filter(Boolean)
            .join(" ")
        ),
    });

    if (!analysis) {
      const message =
        "Vision analysis was requested after repeated failures, but no visual analysis could be produced.";

      return withWorkflowMemory(state, {
        lastError: message,
        observations: appendObservation(state, {
          phase: "vision",
          agentName: "VisionTool",
          toolName: "browser_take_screenshot",
          arguments: {},
          success: false,
          resultText: "",
          errorMessage: message,
        }),
      });
    }

    return withWorkflowMemory(state, {
      latestVisualAnalysis: analysis,
      lastError: state.lastError,
      observations: appendObservation(state, {
        phase: "vision",
        agentName: "VisionTool",
        toolName: "browser_take_screenshot",
        arguments: {},
        success: true,
        resultText: JSON.stringify(analysis),
        reasoning:
          "Screenshot vision was used after repeated failures to understand visible components and blockers.",
      }),
    });
  };

  const graph = new StateGraph(StateAnnotation)
    .addNode("connectMcpNode", connectMcp)
    .addNode("navigateStartNode", navigateStart)
    .addNode("observeForPlanningNode", observeForPlanning)
    .addNode("plannerNode", plan)
    .addNode("analystNode", analyze)
    .addNode("executeToolNode", executeTool)
    .addNode("observeAfterActionNode", observeAfterAction)
    .addNode("verifierNode", verify)
    .addNode("criticNode", critique)
    .addNode("visionNode", analyzeVision)
    .addEdge(START, "connectMcpNode")
    .addEdge("connectMcpNode", "navigateStartNode")
    .addEdge("navigateStartNode", "observeForPlanningNode")
    .addEdge("observeForPlanningNode", "plannerNode")
    .addConditionalEdges("plannerNode", routeAfterPlan)
    .addConditionalEdges("analystNode", routeAfterAnalyze)
    .addConditionalEdges("executeToolNode", routeAfterExecute)
    .addEdge("observeAfterActionNode", "verifierNode")
    .addConditionalEdges("verifierNode", routeAfterVerify)
    .addConditionalEdges("criticNode", routeAfterCritic)
    .addEdge("visionNode", "analystNode");

  return graph.compile();
}

async function observe(
  state: GraphState,
  deps: McpMultiAgentGraphDeps,
  nextPhase: "observe" | "verify"
): Promise<GraphUpdate> {
  if (exceededToolBudget(state)) {
    return failForBudget(state);
  }

  const decision = await deps.observer.decide(state);
  const result = await callMcpTool(
    state,
    deps,
    "observe",
    "McpObserverAgent",
    decision.toolName,
    normalizeObservationArgs(decision.toolName, decision.arguments, state),
    decision.reasoning
  );

  return withWorkflowMemory(state, {
    observationDecision: decision,
    observations: result.observations,
    toolCallCount: state.toolCallCount + 1,
    consecutiveSnapshots:
      decision.toolName === "browser_snapshot" && !result.lastError
        ? state.consecutiveSnapshots + 1
        : 0,
    lastError: result.lastError,
    retryCount: result.lastError ? state.retryCount + 1 : state.retryCount,
  });
}

async function callMcpTool(
  state: GraphState,
  deps: Pick<McpMultiAgentGraphDeps, "mcp" | "enhancedSnapshotTool">,
  phase: McpObservationEntry["phase"],
  agentName: string,
  toolName: string,
  args: Record<string, unknown>,
  reasoning?: string
): Promise<{ observations: McpObservationEntry[]; lastError?: string }> {
  try {
    logger.info(`Calling MCP tool: ${toolName}`, args);
    const normalizedArgs =
      toolName === "browser_snapshot" ? normalizeSnapshotArgs(args, state) : args;
    const result =
      toolName === "browser_snapshot"
        ? await deps.enhancedSnapshotTool.capture(deps.mcp, normalizedArgs)
        : await deps.mcp.callTool(toolName, normalizedArgs);
    const errorMessage = result.isError ? result.text : undefined;

    return {
      observations: appendObservation(state, {
        phase,
        agentName,
        toolName,
        arguments: normalizedArgs,
        success: !result.isError,
        resultText: result.text,
        errorMessage,
        reasoning,
      }),
      lastError: errorMessage,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      observations: appendObservation(state, {
        phase,
        agentName,
        toolName,
        arguments: toolName === "browser_snapshot" ? normalizeSnapshotArgs(args, state) : args,
        success: false,
        resultText: "",
        errorMessage,
        reasoning,
      }),
      lastError: errorMessage,
    };
  }
}

function exceededToolBudget(state: GraphState): boolean {
  return state.toolCallCount >= state.maxToolCalls;
}

function failForBudget(state: GraphState): GraphUpdate {
  return {
    status: "failed",
    finalSummary: `Maximum MCP tool calls (${state.maxToolCalls}) reached before completion.`,
    lastError: `Maximum MCP tool calls (${state.maxToolCalls}) reached.`,
  };
}

function routeAfterPlan(state: GraphState): string {
  if (state.status === "passed" || state.status === "blocked" || state.status === "failed") {
    return END;
  }

  return "analystNode";
}

function routeAfterAnalyze(state: GraphState): string {
  if (state.status !== "running") {
    return END;
  }

  if (state.lastError) {
    return "criticNode";
  }

  return "executeToolNode";
}

function routeAfterExecute(state: GraphState): string {
  if (state.status !== "running") {
    return END;
  }

  if (state.lastError) {
    return "criticNode";
  }

  if (state.consecutiveSnapshots >= 2) {
    return "criticNode";
  }

  return "observeAfterActionNode";
}

function routeAfterVerify(state: GraphState): string {
  if (state.status === "passed" || state.status === "blocked" || state.status === "failed") {
    return END;
  }

  if (state.consecutiveSnapshots >= 2) {
    return "criticNode";
  }

  return "plannerNode";
}

function routeAfterCritic(state: GraphState): string {
  if (state.status === "blocked" || state.status === "failed") {
    return END;
  }

  switch (state.criticDecision?.route) {
    case "retryAnalyze":
      return "analystNode";
    case "observe":
      return "observeForPlanningNode";
    case "vision":
      return "visionNode";
    case "verify":
      return "observeAfterActionNode";
    case "plan":
      return "plannerNode";
    case "blocked":
      return END;
    default:
      return "observeForPlanningNode";
  }
}

function getRecentFailureMessages(state: GraphState): string[] {
  return state.observations
    .filter((entry) => !entry.success)
    .slice(-4)
    .map((entry) =>
      [
        entry.toolName ? `${entry.toolName}:` : entry.agentName,
        entry.errorMessage || entry.resultText || "failed without details",
      ]
        .filter(Boolean)
        .join(" ")
        .slice(0, 1000)
    );
}

function withWorkflowMemory(
  state: GraphState,
  update: GraphUpdate
): GraphUpdate {
  const nextState = {
    ...state,
    ...update,
  } as McpMultiAgentState;

  return {
    ...update,
    workflowMemory: buildWorkflowMemory(nextState),
  };
}

function normalizeObservationArgs(
  toolName: string,
  args: Record<string, unknown>,
  state: GraphState
): Record<string, unknown> {
  return toolName === "browser_snapshot" ? normalizeSnapshotArgs(args, state) : args;
}

function normalizeSnapshotArgs(
  args: Record<string, unknown> = {},
  state: GraphState
): Record<string, unknown> {
  const target = typeof args.target === "string" ? args.target : "";
  const requestedDepth = typeof args.depth === "number" ? args.depth : undefined;
  const targetLooksLikeComplexSurface =
    /dialog|modal|popover|popper|menu|listbox|grid|table|datepicker|date|time|main/i.test(
      target
    );
  const recoveryContext =
    Boolean(state.lastError) ||
    Boolean(state.latestVisualAnalysis) ||
    state.consecutiveSnapshots > 0;
  const minimumDepth = targetLooksLikeComplexSurface || recoveryContext ? 12 : 8;

  return {
    ...args,
    boxes: true,
    depth: Math.max(requestedDepth ?? minimumDepth, minimumDepth),
  };
}
