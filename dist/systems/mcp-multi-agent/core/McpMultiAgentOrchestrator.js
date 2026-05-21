"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpMultiAgentOrchestrator = void 0;
const McpPlannerAgent_1 = require("../agents/McpPlannerAgent");
const McpObserverAgent_1 = require("../agents/McpObserverAgent");
const McpDomAnalystAgent_1 = require("../agents/McpDomAnalystAgent");
const McpCriticAgent_1 = require("../agents/McpCriticAgent");
const McpVerifierAgent_1 = require("../agents/McpVerifierAgent");
const PlaywrightMcpClient_1 = require("../../../utils/PlaywrightMcpClient");
const Logger_1 = require("../../../utils/Logger");
const McpMultiAgentGraph_1 = require("./McpMultiAgentGraph");
const logger = new Logger_1.Logger("McpMultiAgentOrchestrator");
class McpMultiAgentOrchestrator {
    mcp;
    config;
    constructor(config = {}) {
        this.mcp = new PlaywrightMcpClient_1.PlaywrightMcpClient();
        this.config = {
            maxToolCalls: config.maxToolCalls ?? 70,
            recursionLimit: config.recursionLimit ?? 180,
        };
    }
    async run(input, sessionId = `mcp-multi-agent-${Date.now()}`) {
        logger.info(`\n${"=".repeat(60)}`);
        logger.info(` MCP multi-agent LangGraph session: ${sessionId}`);
        logger.info(` Goal: ${input.goal}`);
        logger.info(`${"=".repeat(60)}\n`);
        const graph = (0, McpMultiAgentGraph_1.buildMcpMultiAgentGraph)({
            mcp: this.mcp,
            planner: new McpPlannerAgent_1.McpPlannerAgent(),
            observer: new McpObserverAgent_1.McpObserverAgent(),
            analyst: new McpDomAnalystAgent_1.McpDomAnalystAgent(),
            critic: new McpCriticAgent_1.McpCriticAgent(),
            verifier: new McpVerifierAgent_1.McpVerifierAgent(),
        });
        const initialState = {
            goal: input,
            tools: [],
            observations: [],
            status: "running",
            iteration: 0,
            toolCallCount: 0,
            retryCount: 0,
            consecutiveSnapshots: 0,
            maxToolCalls: this.config.maxToolCalls,
        };
        try {
            const finalState = (await graph.invoke(initialState, {
                recursionLimit: this.config.recursionLimit,
            }));
            return this.finish(finalState, input);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error("MCP multi-agent graph failed:", error);
            return {
                status: "failed",
                goal: input.goal,
                history: [],
                errorMessage,
                finalSummary: errorMessage,
                metrics: {
                    toolCalls: 0,
                    llmObservedSteps: 0,
                    retries: 0,
                },
            };
        }
        finally {
            await this.mcp.close();
        }
    }
    finish(state, input) {
        const status = state.status === "passed" || state.status === "blocked"
            ? state.status
            : "failed";
        const result = {
            status,
            goal: input.goal,
            history: state.observations,
            finalSummary: state.finalSummary,
            errorMessage: status === "failed" ? state.lastError : undefined,
            metrics: {
                toolCalls: state.toolCallCount,
                llmObservedSteps: state.observations.length,
                retries: state.retryCount,
            },
        };
        console.log(this.getSummary(result));
        return result;
    }
    getSummary(result) {
        const succeeded = result.history.filter((entry) => entry.success).length;
        return [
            `\n${"=".repeat(50)}`,
            ` MCP MULTI-AGENT LANGGRAPH SUMMARY`,
            `${"=".repeat(50)}`,
            ` Goal:   ${result.goal}`,
            ` Status: ${result.status.toUpperCase()}`,
            ` Steps:  ${succeeded}/${result.history.length} observed steps succeeded`,
            ` Tools:  ${result.metrics.toolCalls}`,
            ` Retries:${result.metrics.retries}`,
            result.finalSummary ? ` Summary: ${result.finalSummary}` : "",
            result.errorMessage ? ` Error:  ${result.errorMessage}` : "",
            `${"=".repeat(50)}`,
            ...result.history.slice(-20).map((entry) => {
                const icon = entry.success ? "OK" : "FAIL";
                const target = entry.toolName ? ` ${entry.toolName}` : "";
                const error = entry.errorMessage ? ` -> ${entry.errorMessage}` : "";
                return ` ${icon} ${entry.index}. [${entry.phase}] ${entry.agentName}${target}${error}`;
            }),
            `${"=".repeat(50)}\n`,
        ]
            .filter((line) => line.length > 0)
            .join("\n");
    }
}
exports.McpMultiAgentOrchestrator = McpMultiAgentOrchestrator;
