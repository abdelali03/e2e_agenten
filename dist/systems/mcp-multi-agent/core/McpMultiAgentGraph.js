"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildMcpMultiAgentGraph = buildMcpMultiAgentGraph;
const langgraph_1 = require("@langchain/langgraph");
const Logger_1 = require("../../../utils/Logger");
const McpMultiAgentState_1 = require("./McpMultiAgentState");
const logger = new Logger_1.Logger("McpMultiAgentGraph");
const StateAnnotation = langgraph_1.Annotation.Root({
    goal: (langgraph_1.Annotation),
    tools: (langgraph_1.Annotation),
    observations: (langgraph_1.Annotation),
    status: (langgraph_1.Annotation),
    currentSubgoal: (langgraph_1.Annotation),
    expectedOutcome: (langgraph_1.Annotation),
    plan: (langgraph_1.Annotation),
    observationDecision: (langgraph_1.Annotation),
    proposedToolCall: (langgraph_1.Annotation),
    criticDecision: (langgraph_1.Annotation),
    verification: (langgraph_1.Annotation),
    lastError: (langgraph_1.Annotation),
    finalSummary: (langgraph_1.Annotation),
    iteration: (langgraph_1.Annotation),
    toolCallCount: (langgraph_1.Annotation),
    retryCount: (langgraph_1.Annotation),
    consecutiveSnapshots: (langgraph_1.Annotation),
    maxToolCalls: (langgraph_1.Annotation),
});
function buildMcpMultiAgentGraph(deps) {
    const connectMcp = async (state) => {
        await deps.mcp.connect();
        const tools = await deps.mcp.listTools();
        logger.info("MCP multi-agent tools available", {
            tools: tools.map((tool) => tool.name),
        });
        return {
            tools,
            observations: (0, McpMultiAgentState_1.appendObservation)(state, {
                phase: "init",
                agentName: "McpMultiAgentGraph",
                success: true,
                resultText: `Connected to Playwright MCP. Tools: ${tools
                    .map((tool) => tool.name)
                    .join(", ")}`,
            }),
        };
    };
    const navigateStart = async (state) => {
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
    const observeForPlanning = async (state) => {
        return observe(state, deps, "observe");
    };
    const plan = async (state) => {
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
            observations: (0, McpMultiAgentState_1.appendObservation)(state, {
                phase: "plan",
                agentName: "McpPlannerAgent",
                success: true,
                resultText: decision.subgoal ?? "",
                reasoning: decision.reasoning,
            }),
        };
    };
    const analyze = async (state) => {
        try {
            const proposal = await deps.analyst.analyze(state);
            return {
                proposedToolCall: proposal,
                observations: (0, McpMultiAgentState_1.appendObservation)(state, {
                    phase: "analyze",
                    agentName: "McpDomAnalystAgent",
                    toolName: proposal.toolName,
                    arguments: proposal.arguments,
                    success: true,
                    resultText: proposal.elementDescription ?? proposal.toolName,
                    reasoning: proposal.reasoning,
                }),
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return {
                lastError: message,
                observations: (0, McpMultiAgentState_1.appendObservation)(state, {
                    phase: "analyze",
                    agentName: "McpDomAnalystAgent",
                    success: false,
                    resultText: "",
                    errorMessage: message,
                }),
            };
        }
    };
    const executeTool = async (state) => {
        if (exceededToolBudget(state)) {
            return failForBudget(state);
        }
        const proposal = state.proposedToolCall;
        if (!proposal) {
            const error = "No proposed MCP tool call to execute.";
            return {
                lastError: error,
                observations: (0, McpMultiAgentState_1.appendObservation)(state, {
                    phase: "execute",
                    agentName: "McpToolExecutor",
                    success: false,
                    resultText: "",
                    errorMessage: error,
                }),
            };
        }
        const result = await callMcpTool(state, deps.mcp, "execute", "McpToolExecutor", proposal.toolName, proposal.arguments, proposal.reasoning);
        return {
            observations: result.observations,
            toolCallCount: state.toolCallCount + 1,
            retryCount: result.lastError ? state.retryCount + 1 : 0,
            consecutiveSnapshots: proposal.toolName === "browser_snapshot" && !result.lastError
                ? state.consecutiveSnapshots + 1
                : 0,
            lastError: result.lastError,
        };
    };
    const observeAfterAction = async (state) => {
        return observe(state, deps, "verify");
    };
    const verify = async (state) => {
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
            observations: (0, McpMultiAgentState_1.appendObservation)(state, {
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
    const critique = async (state) => {
        const decision = await deps.critic.critique(state);
        return {
            criticDecision: decision,
            currentSubgoal: decision.revisedSubgoal ?? state.currentSubgoal,
            lastError: decision.route === "blocked" ? decision.reasoning : state.lastError,
            status: decision.route === "blocked" ? "blocked" : state.status,
            finalSummary: decision.route === "blocked" ? decision.reasoning : state.finalSummary,
            observations: (0, McpMultiAgentState_1.appendObservation)(state, {
                phase: "critic",
                agentName: "McpCriticAgent",
                success: decision.route !== "blocked",
                resultText: decision.route,
                reasoning: decision.reasoning,
            }),
        };
    };
    const graph = new langgraph_1.StateGraph(StateAnnotation)
        .addNode("connectMcpNode", connectMcp)
        .addNode("navigateStartNode", navigateStart)
        .addNode("observeForPlanningNode", observeForPlanning)
        .addNode("plannerNode", plan)
        .addNode("analystNode", analyze)
        .addNode("executeToolNode", executeTool)
        .addNode("observeAfterActionNode", observeAfterAction)
        .addNode("verifierNode", verify)
        .addNode("criticNode", critique)
        .addEdge(langgraph_1.START, "connectMcpNode")
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
async function observe(state, deps, nextPhase) {
    if (exceededToolBudget(state)) {
        return failForBudget(state);
    }
    const decision = await deps.observer.decide(state);
    const result = await callMcpTool(state, deps.mcp, "observe", "McpObserverAgent", decision.toolName, decision.arguments, decision.reasoning);
    return {
        observationDecision: decision,
        observations: result.observations,
        toolCallCount: state.toolCallCount + 1,
        consecutiveSnapshots: decision.toolName === "browser_snapshot" && !result.lastError
            ? state.consecutiveSnapshots + 1
            : 0,
        lastError: result.lastError,
        retryCount: result.lastError ? state.retryCount + 1 : state.retryCount,
    };
}
async function callMcpTool(state, mcp, phase, agentName, toolName, args, reasoning) {
    try {
        logger.info(`Calling MCP tool: ${toolName}`, args);
        const result = await mcp.callTool(toolName, args);
        const errorMessage = result.isError ? result.text : undefined;
        return {
            observations: (0, McpMultiAgentState_1.appendObservation)(state, {
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
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            observations: (0, McpMultiAgentState_1.appendObservation)(state, {
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
function exceededToolBudget(state) {
    return state.toolCallCount >= state.maxToolCalls;
}
function failForBudget(state) {
    return {
        status: "failed",
        finalSummary: `Maximum MCP tool calls (${state.maxToolCalls}) reached before completion.`,
        lastError: `Maximum MCP tool calls (${state.maxToolCalls}) reached.`,
    };
}
function routeAfterPlan(state) {
    if (state.status === "passed" || state.status === "blocked" || state.status === "failed") {
        return langgraph_1.END;
    }
    return "analystNode";
}
function routeAfterAnalyze(state) {
    if (state.status !== "running") {
        return langgraph_1.END;
    }
    if (state.lastError) {
        return "criticNode";
    }
    return "executeToolNode";
}
function routeAfterExecute(state) {
    if (state.status !== "running") {
        return langgraph_1.END;
    }
    if (state.lastError) {
        return "criticNode";
    }
    return "observeAfterActionNode";
}
function routeAfterVerify(state) {
    if (state.status === "passed" || state.status === "blocked" || state.status === "failed") {
        return langgraph_1.END;
    }
    return "plannerNode";
}
function routeAfterCritic(state) {
    if (state.status === "blocked" || state.status === "failed") {
        return langgraph_1.END;
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
            return langgraph_1.END;
        default:
            return "observeForPlanningNode";
    }
}
