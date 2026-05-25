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
import { buildMcpMultiAgentGraph } from "./McpMultiAgentGraph";
import type { McpMultiAgentState } from "./McpMultiAgentState";

const logger = new Logger("McpMultiAgentOrchestrator");

export interface McpMultiAgentOrchestratorConfig {
  maxToolCalls?: number;
  recursionLimit?: number;
}

export interface McpMultiAgentRunResult {
  status: "passed" | "failed" | "blocked";
  goal: string;
  history: McpMultiAgentState["observations"];
  finalSummary?: string;
  errorMessage?: string;
  metrics: {
    toolCalls: number;
    llmObservedSteps: number;
    retries: number;
  };
}

export class McpMultiAgentOrchestrator {
  private readonly mcp: PlaywrightMcpClient;
  private readonly config: Required<McpMultiAgentOrchestratorConfig>;

  constructor(config: McpMultiAgentOrchestratorConfig = {}) {
    this.mcp = new PlaywrightMcpClient();
    this.config = {
      maxToolCalls: config.maxToolCalls ?? 70,
      recursionLimit: config.recursionLimit ?? 180,
    };
  }

  public async run(
    input: GoalInput,
    sessionId = `mcp-multi-agent-${Date.now()}`
  ): Promise<McpMultiAgentRunResult> {
    logger.info(`\n${"=".repeat(60)}`);
    logger.info(` MCP multi-agent LangGraph session: ${sessionId}`);
    logger.info(` Goal: ${input.goal}`);
    logger.info(`${"=".repeat(60)}\n`);

    const graph = buildMcpMultiAgentGraph({
      mcp: this.mcp,
      planner: new McpPlannerAgent(),
      observer: new McpObserverAgent(),
      analyst: new McpDomAnalystAgent(),
      critic: new McpCriticAgent(),
      verifier: new McpVerifierAgent(),
      visionTool: new VisionTool(),
      enhancedSnapshotTool: new EnhancedMcpSnapshotTool(),
    });

    const initialState: Partial<McpMultiAgentState> = {
      goal: input,
      tools: [],
      observations: [],
      status: "running",
      iteration: 0,
      toolCallCount: 0,
      retryCount: 0,
      consecutiveSnapshots: 0,
      maxToolCalls: this.config.maxToolCalls,
      workflowMemory: undefined,
      lastFailedPhase: undefined,
      lastActionError: undefined,
      lastObservationError: undefined,
      lastAnalysisError: undefined,
      lastVerificationError: undefined,
    };

    try {
      const finalState = (await graph.invoke(initialState as any, {
        recursionLimit: this.config.recursionLimit,
      })) as McpMultiAgentState;

      return this.finish(finalState, input);
    } catch (error) {
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
    } finally {
      await this.mcp.close();
    }
  }

  private finish(
    state: McpMultiAgentState,
    input: GoalInput
  ): McpMultiAgentRunResult {
    const status =
      state.status === "passed" || state.status === "blocked"
        ? state.status
        : "failed";

    const result: McpMultiAgentRunResult = {
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

  private getSummary(result: McpMultiAgentRunResult): string {
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
