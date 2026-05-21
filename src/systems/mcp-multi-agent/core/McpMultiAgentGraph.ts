import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { McpPlannerAgent } from "../agents/McpPlannerAgent";
import { McpObserverAgent } from "../agents/McpObserverAgent";
import { McpDomAnalystAgent } from "../agents/McpDomAnalystAgent";
import { McpCriticAgent } from "../agents/McpCriticAgent";
import { McpVerifierAgent } from "../agents/McpVerifierAgent";
import { PlaywrightMcpClient } from "../../../utils/PlaywrightMcpClient";
import { Logger } from "../../../utils/Logger";
import type { GoalInput } from "../../../core/types";
import type { McpToolInfo } from "../../../utils/PlaywrightMcpClient";
import {
  appendObservation,
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
    const result = await callMcpTool(state, deps.mcp, "init", "Navigator", toolName, args);

    return {
      observations: result.observations,
      toolCallCount: state.toolCallCount + 1,
      consecutiveSnapshots: 0,
      lastError: result.lastError,
    };
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

    return {
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
    };
  };

  const analyze = async (state: GraphState): Promise<GraphUpdate> => {
    try {
      const proposal = await deps.analyst.analyze(state);

      return {
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
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        lastError: message,
        observations: appendObservation(state, {
          phase: "analyze",
          agentName: "McpDomAnalystAgent",
          success: false,
          resultText: "",
          errorMessage: message,
        }),
      };
    }
  };

  const executeTool = async (state: GraphState): Promise<GraphUpdate> => {
    if (exceededToolBudget(state)) {
      return failForBudget(state);
    }

    const proposal = state.proposedToolCall;
    if (!proposal) {
      const error = "No proposed MCP tool call to execute.";
      return {
        lastError: error,
        observations: appendObservation(state, {
          phase: "execute",
          agentName: "McpToolExecutor",
          success: false,
          resultText: "",
          errorMessage: error,
        }),
      };
    }

    const result = await callMcpTool(
      state,
      deps.mcp,
      "execute",
      "McpToolExecutor",
      proposal.toolName,
      proposal.arguments,
      proposal.reasoning
    );

    return {
      observations: result.observations,
      toolCallCount: state.toolCallCount + 1,
      retryCount: result.lastError ? state.retryCount + 1 : 0,
      consecutiveSnapshots:
        proposal.toolName === "browser_snapshot" && !result.lastError
          ? state.consecutiveSnapshots + 1
          : 0,
      lastError: result.lastError,
    };
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

    return {
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
    };
  };

  const critique = async (state: GraphState): Promise<GraphUpdate> => {
    const decision = await deps.critic.critique(state);

    return {
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
    };
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
    .addEdge(START, "connectMcpNode")
    .addEdge("connectMcpNode", "navigateStartNode")
    .addEdge("navigateStartNode", "observeForPlanningNode")
    .addEdge("observeForPlanningNode", "plannerNode")
    .addConditionalEdges("plannerNode", routeAfterPlan)
    .addConditionalEdges("analystNode", routeAfterAnalyze)
    .addConditionalEdges("executeToolNode", routeAfterExecute)
    .addEdge("observeAfterActionNode", "verifierNode")
    .addConditionalEdges("verifierNode", routeAfterVerify)
    .addConditionalEdges("criticNode", routeAfterCritic);

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
    deps.mcp,
    "observe",
    "McpObserverAgent",
    decision.toolName,
    decision.arguments,
    decision.reasoning
  );

  return {
    observationDecision: decision,
    observations: result.observations,
    toolCallCount: state.toolCallCount + 1,
    consecutiveSnapshots:
      decision.toolName === "browser_snapshot" && !result.lastError
        ? state.consecutiveSnapshots + 1
        : 0,
    lastError: result.lastError,
    retryCount: result.lastError ? state.retryCount + 1 : state.retryCount,
  };
}

async function callMcpTool(
  state: GraphState,
  mcp: PlaywrightMcpClient,
  phase: McpObservationEntry["phase"],
  agentName: string,
  toolName: string,
  args: Record<string, unknown>,
  reasoning?: string
): Promise<{ observations: McpObservationEntry[]; lastError?: string }> {
  try {
    logger.info(`Calling MCP tool: ${toolName}`, args);
    const result = await mcp.callTool(toolName, args);
    const errorMessage = result.isError ? result.text : undefined;

    return {
      observations: appendObservation(state, {
        phase,
        agentName,
        toolName,
        arguments: args,
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
        arguments: args,
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

  return "observeAfterActionNode";
}

function routeAfterVerify(state: GraphState): string {
  if (state.status === "passed" || state.status === "blocked" || state.status === "failed") {
    return END;
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
