"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compactTools = compactTools;
exports.compactObservations = compactObservations;
exports.appendObservation = appendObservation;
exports.toolExists = toolExists;
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
