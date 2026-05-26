"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildMcpMultiAgentGraph = buildMcpMultiAgentGraph;
const langgraph_1 = require("@langchain/langgraph");
const Logger_1 = require("../../../utils/Logger");
const SelectorGuard_1 = require("../../../utils/SelectorGuard");
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
    latestVisualAnalysis: (langgraph_1.Annotation),
    workflowMemory: (langgraph_1.Annotation),
    lastFailedPhase: (langgraph_1.Annotation),
    lastActionError: (langgraph_1.Annotation),
    lastObservationError: (langgraph_1.Annotation),
    lastAnalysisError: (langgraph_1.Annotation),
    lastVerificationError: (langgraph_1.Annotation),
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
        const result = await callMcpTool(state, deps, "init", "Navigator", toolName, args);
        return withWorkflowMemory(state, {
            observations: result.observations,
            toolCallCount: state.toolCallCount + 1,
            consecutiveSnapshots: 0,
            lastError: result.lastError,
        });
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
        return withWorkflowMemory(state, {
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
        });
    };
    const analyze = async (state) => {
        try {
            const proposal = await deps.analyst.analyze(state);
            return withWorkflowMemory(state, {
                proposedToolCall: proposal,
                lastError: undefined,
                lastAnalysisError: undefined,
                lastFailedPhase: undefined,
                observations: (0, McpMultiAgentState_1.appendObservation)(state, {
                    phase: "analyze",
                    agentName: "McpDomAnalystAgent",
                    toolName: proposal.toolName,
                    arguments: proposal.arguments,
                    success: true,
                    resultText: proposal.elementDescription ?? proposal.toolName,
                    reasoning: proposal.reasoning,
                }),
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return withWorkflowMemory(state, {
                lastError: message,
                lastAnalysisError: message,
                lastFailedPhase: "analyze",
                observations: (0, McpMultiAgentState_1.appendObservation)(state, {
                    phase: "analyze",
                    agentName: "McpDomAnalystAgent",
                    success: false,
                    resultText: "",
                    errorMessage: message,
                }),
            });
        }
    };
    const executeTool = async (state) => {
        if (exceededToolBudget(state)) {
            return failForBudget(state);
        }
        const proposal = state.proposedToolCall;
        if (!proposal) {
            const error = "No proposed MCP tool call to execute.";
            return withWorkflowMemory(state, {
                lastError: error,
                observations: (0, McpMultiAgentState_1.appendObservation)(state, {
                    phase: "execute",
                    agentName: "McpToolExecutor",
                    success: false,
                    resultText: "",
                    errorMessage: error,
                }),
            });
        }
        const guard = (0, SelectorGuard_1.validateMcpActionTarget)(proposal.toolName, proposal.arguments);
        if (!guard.ok) {
            const error = `SelectorGuard rejected ${proposal.toolName}: ${guard.error}`;
            return withWorkflowMemory(state, {
                lastError: error,
                lastActionError: error,
                lastFailedPhase: "execute",
                observations: (0, McpMultiAgentState_1.appendObservation)(state, {
                    phase: "execute",
                    agentName: "SelectorGuard",
                    toolName: proposal.toolName,
                    arguments: proposal.arguments,
                    success: false,
                    resultText: "",
                    errorMessage: error,
                    reasoning: "Rejected invalid executable target before calling MCP. Visual hints must be resolved to MCP refs/selectors first.",
                }),
            });
        }
        const result = await callMcpTool(state, deps, "execute", "McpToolExecutor", proposal.toolName, proposal.arguments, proposal.reasoning);
        return withWorkflowMemory(state, {
            observations: result.observations,
            toolCallCount: state.toolCallCount + 1,
            retryCount: result.lastError ? state.retryCount + 1 : 0,
            consecutiveSnapshots: proposal.toolName === "browser_snapshot" && !result.lastError
                ? state.consecutiveSnapshots + 1
                : 0,
            lastError: result.lastError,
            lastActionError: result.lastError,
            lastFailedPhase: result.lastError ? "execute" : undefined,
        });
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
        return withWorkflowMemory(state, {
            verification: decision,
            lastVerificationError: undefined,
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
        });
    };
    const critique = async (state) => {
        const decision = await deps.critic.critique(state);
        return withWorkflowMemory(state, {
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
        });
    };
    const analyzeVision = async (state) => {
        const analysis = await deps.visionTool.analyzeCurrentPage(deps.mcp, {
            goal: state.goal.goal,
            currentSubgoal: state.currentSubgoal,
            expectedOutcome: state.expectedOutcome,
            visualTask: buildVisualTask(state),
            lastError: state.lastError,
            recentFailures: getRecentFailureMessages(state),
            recentObservations: state.observations
                .slice(-4)
                .map((entry) => [
                `[${entry.phase}] ${entry.agentName}`,
                entry.toolName ? `tool=${entry.toolName}` : "",
                entry.errorMessage ? `error=${entry.errorMessage}` : "",
                entry.resultText ? `result=${entry.resultText.slice(0, 500)}` : "",
            ]
                .filter(Boolean)
                .join(" ")),
        });
        if (!analysis) {
            const message = "Vision analysis was requested after repeated failures, but no visual analysis could be produced.";
            return withWorkflowMemory(state, {
                lastError: message,
                lastObservationError: message,
                lastFailedPhase: "vision",
                observations: (0, McpMultiAgentState_1.appendObservation)(state, {
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
            lastFailedPhase: undefined,
            consecutiveSnapshots: 0,
            observations: (0, McpMultiAgentState_1.appendObservation)(state, {
                phase: "vision",
                agentName: "VisionTool",
                toolName: "browser_take_screenshot",
                arguments: {},
                success: true,
                resultText: JSON.stringify(analysis),
                reasoning: "Screenshot vision was used after repeated failures to understand visible components and blockers.",
            }),
        });
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
        .addNode("visionNode", analyzeVision)
        .addEdge(langgraph_1.START, "connectMcpNode")
        .addEdge("connectMcpNode", "navigateStartNode")
        .addEdge("navigateStartNode", "observeForPlanningNode")
        .addConditionalEdges("observeForPlanningNode", routeAfterObserveForPlanning)
        .addConditionalEdges("plannerNode", routeAfterPlan)
        .addConditionalEdges("analystNode", routeAfterAnalyze)
        .addConditionalEdges("executeToolNode", routeAfterExecute)
        .addConditionalEdges("observeAfterActionNode", routeAfterObserveAfterAction)
        .addConditionalEdges("verifierNode", routeAfterVerify)
        .addConditionalEdges("criticNode", routeAfterCritic)
        .addEdge("visionNode", "analystNode");
    return graph.compile();
}
async function observe(state, deps, nextPhase) {
    if (exceededToolBudget(state)) {
        return failForBudget(state);
    }
    const decision = await deps.observer.decide(state);
    const result = await callMcpTool(state, deps, "observe", "McpObserverAgent", decision.toolName, normalizeObservationArgs(decision.toolName, decision.arguments, state), decision.reasoning);
    const visualAnalysis = decision.toolName === "browser_take_screenshot" && !result.lastError
        ? result.images?.[0]?.data
            ? await deps.visionTool.analyzeScreenshotBase64(result.images[0].data, buildVisionInput(state))
            : await deps.visionTool.analyzeCurrentPage(deps.mcp, buildVisionInput(state))
        : undefined;
    const observations = visualAnalysis
        ? [
            ...result.observations,
            {
                index: result.observations.length + 1,
                phase: "vision",
                agentName: "VisionTool",
                toolName: "browser_take_screenshot",
                arguments: { trigger: "screenshot_observation_bridge" },
                success: true,
                resultText: JSON.stringify(visualAnalysis),
                reasoning: "Structured vision analysis was attached after browser_take_screenshot so later agents can reason over the image content.",
            },
        ]
        : result.observations;
    return withWorkflowMemory(state, {
        observationDecision: decision,
        observations,
        latestVisualAnalysis: visualAnalysis ?? state.latestVisualAnalysis,
        toolCallCount: state.toolCallCount + 1,
        consecutiveSnapshots: visualAnalysis
            ? 0
            : decision.toolName === "browser_snapshot" && !result.lastError
                ? state.consecutiveSnapshots + 1
                : decision.toolName === "browser_take_screenshot" && !result.lastError
                    ? state.consecutiveSnapshots
                    : 0,
        lastError: result.lastError,
        lastObservationError: result.lastError,
        lastFailedPhase: result.lastError ? "observe" : undefined,
        retryCount: result.lastError ? state.retryCount + 1 : state.retryCount,
    });
}
async function callMcpTool(state, deps, phase, agentName, toolName, args, reasoning) {
    try {
        logger.info(`Calling MCP tool: ${toolName}`, args);
        const normalizedArgs = normalizeMcpToolArgs(toolName, args, state);
        const result = toolName === "browser_snapshot"
            ? await deps.enhancedSnapshotTool.capture(deps.mcp, normalizedArgs)
            : await deps.mcp.callTool(toolName, normalizedArgs);
        const errorMessage = result.isError ? result.text : undefined;
        return {
            observations: (0, McpMultiAgentState_1.appendObservation)(state, {
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
            images: "images" in result ? result.images : undefined,
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            observations: (0, McpMultiAgentState_1.appendObservation)(state, {
                phase,
                agentName,
                toolName,
                arguments: normalizeMcpToolArgs(toolName, args, state),
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
function routeAfterObserveForPlanning(state) {
    if (state.status !== "running") {
        return langgraph_1.END;
    }
    if (state.lastFailedPhase === "observe") {
        return "criticNode";
    }
    if (state.consecutiveSnapshots >= 3) {
        return "criticNode";
    }
    return "plannerNode";
}
function routeAfterAnalyze(state) {
    if (state.status !== "running") {
        return langgraph_1.END;
    }
    if (state.lastFailedPhase === "analyze") {
        return "criticNode";
    }
    if (state.proposedToolCall?.status === "needsPerception") {
        return "observeForPlanningNode";
    }
    return "executeToolNode";
}
function routeAfterExecute(state) {
    if (state.status !== "running") {
        return langgraph_1.END;
    }
    if (state.lastFailedPhase === "execute") {
        return "criticNode";
    }
    if (state.consecutiveSnapshots >= 2) {
        return "criticNode";
    }
    return "observeAfterActionNode";
}
function routeAfterObserveAfterAction(state) {
    if (state.status !== "running") {
        return langgraph_1.END;
    }
    if (state.lastFailedPhase === "observe") {
        return "criticNode";
    }
    if (shouldVerifyAfterObservation(state)) {
        return "verifierNode";
    }
    return "plannerNode";
}
function routeAfterVerify(state) {
    if (state.status === "passed" || state.status === "blocked" || state.status === "failed") {
        return langgraph_1.END;
    }
    if (state.consecutiveSnapshots >= 2) {
        return "criticNode";
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
        case "vision":
            return "visionNode";
        case "verify":
            return "verifierNode";
        case "plan":
            return "plannerNode";
        case "blocked":
            return langgraph_1.END;
        default:
            return "observeForPlanningNode";
    }
}
function shouldVerifyAfterObservation(state) {
    const lastExecution = [...state.observations]
        .reverse()
        .find((entry) => entry.phase === "execute" && entry.toolName);
    if (!lastExecution || !lastExecution.success) {
        return false;
    }
    const actionText = [
        lastExecution.toolName,
        lastExecution.reasoning,
        lastExecution.resultText,
        JSON.stringify(lastExecution.arguments ?? {}),
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
    if (/\b(create|created|save|saved|submit|submitted|finish|finished|confirm|confirmed|complete|completed|done|apply|applied)\b/.test(actionText)) {
        return true;
    }
    return false;
}
function getRecentFailureMessages(state) {
    return state.observations
        .filter((entry) => !entry.success)
        .slice(-4)
        .map((entry) => [
        entry.toolName ? `${entry.toolName}:` : entry.agentName,
        entry.errorMessage || entry.resultText || "failed without details",
    ]
        .filter(Boolean)
        .join(" ")
        .slice(0, 1000));
}
function buildVisionInput(state) {
    return {
        goal: state.goal.goal,
        currentSubgoal: state.currentSubgoal,
        expectedOutcome: state.expectedOutcome,
        visualTask: buildVisualTask(state),
        lastError: state.lastError,
        recentFailures: getRecentFailureMessages(state),
        recentObservations: state.observations
            .slice(-4)
            .map((entry) => [
            `[${entry.phase}] ${entry.agentName}`,
            entry.toolName ? `tool=${entry.toolName}` : "",
            entry.errorMessage ? `error=${entry.errorMessage}` : "",
            entry.resultText ? `result=${entry.resultText.slice(0, 500)}` : "",
        ]
            .filter(Boolean)
            .join(" ")),
    };
}
function buildVisualTask(state) {
    const goal = state.goal.goal;
    const subgoal = state.currentSubgoal || "No current subgoal.";
    const expectedOutcome = state.expectedOutcome || "No expected outcome.";
    const missing = state.verification?.missing?.slice(0, 5).join("; ");
    const evidence = state.verification?.evidence?.slice(0, 5).join("; ");
    return [
        `Answer the current browser automation question visually.`,
        `Overall goal: ${goal}`,
        `Current subgoal: ${subgoal}`,
        `Expected outcome: ${expectedOutcome}`,
        evidence ? `Known evidence: ${evidence}` : "",
        missing ? `Missing proof or next visual target: ${missing}` : "",
        `If the task is verification, explicitly say whether the requested UI state is visible, not visible, or uncertain, and cite visible text, layout position, and color/state cues.`,
        `If the task is action planning, identify the relevant visible component and the safest next action in natural language without inventing selectors or coordinates.`,
    ]
        .filter(Boolean)
        .join("\n");
}
function withWorkflowMemory(state, update) {
    const nextState = {
        ...state,
        ...update,
    };
    return {
        ...update,
        workflowMemory: (0, McpMultiAgentState_1.buildWorkflowMemory)(nextState),
    };
}
function normalizeObservationArgs(toolName, args, state) {
    if (toolName === "browser_snapshot") {
        return normalizeSnapshotArgs(args, state);
    }
    if (toolName === "browser_take_screenshot") {
        return normalizeScreenshotArgs(args);
    }
    return args;
}
function normalizeMcpToolArgs(toolName, args, state) {
    return toolName === "browser_snapshot"
        ? normalizeSnapshotArgs(args, state)
        : toolName === "browser_take_screenshot"
            ? normalizeScreenshotArgs(args)
            : args;
}
function normalizeSnapshotArgs(args = {}, state) {
    const rawTarget = typeof args.target === "string" ? args.target : "";
    const requestedTarget = sanitizeSnapshotTarget(rawTarget);
    const forcedActiveSurfaceTarget = getActiveSurfaceSnapshotTarget(requestedTarget, state);
    const target = forcedActiveSurfaceTarget || requestedTarget;
    const requestedDepth = typeof args.depth === "number" ? args.depth : undefined;
    const targetLooksLikeComplexSurface = /dialog|modal|popover|popper|menu|listbox|grid|table|datepicker|date|time|main/i.test(target);
    const recoveryContext = Boolean(state.lastError) ||
        Boolean(state.latestVisualAnalysis) ||
        state.consecutiveSnapshots > 0;
    const minimumDepth = targetLooksLikeComplexSurface || recoveryContext ? 12 : 8;
    const maximumDepth = target ? 60 : 24;
    const desiredDepth = Math.max(requestedDepth ?? (forcedActiveSurfaceTarget ? 16 : minimumDepth), forcedActiveSurfaceTarget ? 16 : minimumDepth);
    return {
        ...args,
        perceptionQuestion: buildPerceptionQuestion(state, {
            ...args,
            target: target || undefined,
        }),
        target: target || undefined,
        boxes: true,
        depth: Math.min(desiredDepth, maximumDepth),
    };
}
function normalizeScreenshotArgs(args = {}) {
    const rawTarget = typeof args.target === "string" ? args.target.trim() : "";
    const isBareMcpRef = /^(ref=)?e\d+$/i.test(rawTarget) || /^target=e\d+$/i.test(rawTarget);
    const target = rawTarget && !isBareMcpRef ? sanitizeSnapshotTarget(rawTarget) || undefined : undefined;
    const normalized = {
        ...args,
        type: typeof args.type === "string" ? args.type : "png",
    };
    delete normalized.target;
    if (target)
        normalized.target = target;
    return normalized;
}
function sanitizeSnapshotTarget(target) {
    const trimmed = target.trim();
    if (!trimmed)
        return "";
    if (/^(ref=)?e\d+$/i.test(trimmed) || /^target=e\d+$/i.test(trimmed)) {
        return "";
    }
    if (/^css=/i.test(trimmed)) {
        return trimmed.replace(/^css=/i, "").trim();
    }
    if (/^(dialog|modal|overlay)$/i.test(trimmed)) {
        return "[role=\"dialog\"], [aria-modal=\"true\"], dialog, [class*=\"Dialog\"], [class*=\"Modal\"], [class*=\"modal\"]";
    }
    if (/^(main|content|main content)$/i.test(trimmed)) {
        return "main, [role=\"main\"], #root main";
    }
    if (/^(menu|popup|popover|dropdown)$/i.test(trimmed)) {
        return "[role=\"menu\"], [role=\"listbox\"], [role=\"tree\"], [role=\"tooltip\"], [class*=\"Popover\"], [class*=\"Popper\"], [class*=\"Menu\"]";
    }
    return trimmed;
}
function buildPerceptionQuestion(state, args) {
    const target = typeof args.target === "string" ? args.target : "";
    const scope = target ? `Requested snapshot target/scope: ${target}.` : "";
    const need = state.proposedToolCall?.perceptionRequest;
    const missing = state.verification?.missing?.slice(0, 4).join("; ");
    const lastError = state.lastError ? `Last error: ${state.lastError.slice(0, 500)}` : "";
    return [
        `Current subgoal: ${state.currentSubgoal || "No current subgoal"}`,
        state.expectedOutcome ? `Expected outcome: ${state.expectedOutcome}` : "",
        need?.scopeHint ? `Requested perception scope: ${need.scopeHint}` : "",
        need?.reasoning ? `Perception reason: ${need.reasoning}` : "",
        missing ? `Missing evidence/actions: ${missing}` : "",
        scope,
        lastError,
        `Return a compact generic scene graph with the most relevant region and actionable MCP refs for this question.`,
    ]
        .filter(Boolean)
        .join("\n");
}
function getActiveSurfaceSnapshotTarget(requestedTarget, state) {
    if (requestedTarget.trim()) {
        return undefined;
    }
    const lastSnapshotFailure = [...state.observations]
        .reverse()
        .find((entry) => entry.toolName === "browser_snapshot" && !entry.success);
    const failedSnapshotArgs = lastSnapshotFailure?.arguments ?? {};
    const failedSnapshotTarget = typeof failedSnapshotArgs.target === "string" ? failedSnapshotArgs.target : "";
    if (failedSnapshotTarget &&
        /role=|aria-modal|dialog|menu|listbox|tree|tooltip/i.test(failedSnapshotTarget)) {
        return undefined;
    }
    const evidence = [
        state.lastError,
        state.lastActionError,
        state.lastObservationError,
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
    if (!evidence) {
        return undefined;
    }
    if (/intercepting pointer events|pointer events|backdrop|aria-modal|modal is open|dialog is open|blocked by (a )?(dialog|modal|overlay)/.test(evidence)) {
        return "[role=\"dialog\"], [aria-modal=\"true\"], dialog";
    }
    if (/blocked by (a )?(menu|listbox|popover|dropdown)|popover is open|menu is open|listbox is open/.test(evidence)) {
        return "[role=\"menu\"], [role=\"listbox\"], [role=\"tree\"], [role=\"tooltip\"], [role=\"dialog\"]";
    }
    return undefined;
}
