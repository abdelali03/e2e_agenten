"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compactTools = compactTools;
exports.compactObservations = compactObservations;
exports.appendObservation = appendObservation;
exports.toolExists = toolExists;
exports.buildWorkflowMemory = buildWorkflowMemory;
function compactTools(tools) {
    return tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
    }));
}
function compactObservations(observations, latestMax = 12_000, olderMax = 1_800) {
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
function appendObservation(state, entry) {
    return [
        ...state.observations,
        {
            ...entry,
            index: state.observations.length + 1,
        },
    ];
}
function toolExists(tools, toolName) {
    return tools.some((tool) => tool.name === toolName);
}
function buildWorkflowMemory(state) {
    const successfulActions = state.observations
        .filter((entry) => entry.success &&
        entry.toolName &&
        !["browser_snapshot", "browser_take_screenshot"].includes(entry.toolName) &&
        entry.phase !== "plan" &&
        entry.phase !== "analyze" &&
        entry.phase !== "critic" &&
        entry.phase !== "verify" &&
        entry.phase !== "vision")
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
    return JSON.stringify({
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
    }, null, 2).slice(0, 10_000);
}
function compactArguments(args) {
    if (!args) {
        return undefined;
    }
    const compact = {};
    for (const [key, value] of Object.entries(args)) {
        compact[key] =
            typeof value === "string" && value.length > 300
                ? `${value.slice(0, 300)}...`
                : value;
    }
    return compact;
}
