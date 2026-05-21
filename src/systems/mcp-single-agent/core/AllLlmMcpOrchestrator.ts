import { AllLlmMcpAgent } from "../agents/AllLlmMcpAgent";
import type { McpObservationEntry } from "../agents/AllLlmMcpAgent";
import { PlaywrightMcpClient } from "../../../utils/PlaywrightMcpClient";
import { Logger } from "../../../utils/Logger";
import type { GoalInput } from "../../../core/types";

const logger = new Logger("AllLlmMcpOrchestrator");

export interface AllLlmMcpOrchestratorConfig {
  maxToolCalls?: number;
}

export interface AllLlmMcpRunResult {
  status: "passed" | "failed" | "blocked";
  goal: string;
  history: McpObservationEntry[];
  finalSummary?: string;
  errorMessage?: string;
}

export class AllLlmMcpOrchestrator {
  private readonly mcp: PlaywrightMcpClient;
  private readonly agent: AllLlmMcpAgent;
  private readonly config: Required<AllLlmMcpOrchestratorConfig>;

  constructor(config: AllLlmMcpOrchestratorConfig = {}) {
    this.mcp = new PlaywrightMcpClient();
    this.agent = new AllLlmMcpAgent();
    this.config = {
      maxToolCalls: config.maxToolCalls ?? 50,
    };
  }

  public async run(
    input: GoalInput,
    sessionId = `all-llm-mcp-${Date.now()}`
  ): Promise<AllLlmMcpRunResult> {
    logger.info(`\n${"=".repeat(60)}`);
    logger.info(` All-LLM MCP session: ${sessionId}`);
    logger.info(` Goal: ${input.goal}`);
    logger.info(`${"=".repeat(60)}\n`);

    const history: McpObservationEntry[] = [];
    let lastError: string | undefined;

    try {
      await this.mcp.connect();
      const tools = await this.mcp.listTools();

      logger.info("Playwright MCP tools available", {
        tools: tools.map((tool) => tool.name),
      });

      for (let index = 1; index <= this.config.maxToolCalls; index += 1) {
        lastError = this.getLoopHint(history, lastError);

        const decision = await this.agent
          .decide({
            goal: input,
            tools,
            observations: history,
            lastError,
          })
          .catch((error) => {
            const errorMessage =
              error instanceof Error ? error.message : String(error);

            lastError = `LLM decision failed: ${errorMessage}`;
            history.push({
              index,
              toolName: "llm_decision",
              arguments: {},
              success: false,
              resultText:
                "The model failed to return a valid MCP tool decision. Try again with valid JSON and an existing tool name.",
              errorMessage: lastError,
            });

            logger.warn(lastError);
            return undefined;
          });

        if (!decision) {
          continue;
        }

        if (decision.status === "complete") {
          return this.finish("passed", input, history, decision.finalSummary);
        }

        if (decision.status === "blocked") {
          return this.finish(
            "blocked",
            input,
            history,
            decision.finalSummary,
            decision.reasoning
          );
        }

        logger.info(
          `\n-- All-LLM MCP tool ${index}/${this.config.maxToolCalls}: ${decision.toolName} --`,
          decision.arguments
        );

        try {
          const result = await this.mcp.callTool(
            decision.toolName!,
            decision.arguments ?? {}
          );

          const errorMessage = result.isError ? result.text : undefined;
          lastError = errorMessage;

          history.push({
            index,
            toolName: decision.toolName!,
            arguments: decision.arguments ?? {},
            success: !result.isError,
            resultText: result.text,
            errorMessage,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          lastError = errorMessage;

          history.push({
            index,
            toolName: decision.toolName!,
            arguments: decision.arguments ?? {},
            success: false,
            resultText: "",
            errorMessage,
          });
        }
      }

      return this.finish(
        "failed",
        input,
        history,
        undefined,
        `Maximum MCP tool calls (${this.config.maxToolCalls}) reached before completion.`
      );
    } finally {
      await this.mcp.close();
    }
  }

  private getLoopHint(
    history: McpObservationEntry[],
    lastError: string | undefined
  ): string | undefined {
    const recent = history.slice(-3);

    if (
      recent.length === 3 &&
      recent.every((entry) => entry.toolName === "browser_snapshot" && entry.success)
    ) {
      return [
        lastError,
        "You called browser_snapshot repeatedly. The latest snapshot is available. Choose an interaction tool now, such as browser_click, browser_fill_form, browser_type, browser_press_key, browser_select_option, or browser_wait_for.",
      ]
        .filter(Boolean)
        .join("\n");
    }

    return lastError;
  }

  private finish(
    status: AllLlmMcpRunResult["status"],
    input: GoalInput,
    history: McpObservationEntry[],
    finalSummary?: string,
    errorMessage?: string
  ): AllLlmMcpRunResult {
    const result: AllLlmMcpRunResult = {
      status,
      goal: input.goal,
      history,
      finalSummary,
      errorMessage,
    };

    console.log(this.getSummary(result));
    return result;
  }

  private getSummary(result: AllLlmMcpRunResult): string {
    const succeeded = result.history.filter((entry) => entry.success).length;

    return [
      `\n${"=".repeat(50)}`,
      ` ALL-LLM MCP TEST SUMMARY`,
      `${"=".repeat(50)}`,
      ` Goal:   ${result.goal}`,
      ` Status: ${result.status.toUpperCase()}`,
      ` Tools:  ${succeeded}/${result.history.length} calls succeeded`,
      result.finalSummary ? ` Summary: ${result.finalSummary}` : "",
      result.errorMessage ? ` Error:  ${result.errorMessage}` : "",
      `${"=".repeat(50)}`,
      ...result.history.map((entry) => {
        const icon = entry.success ? "OK" : "FAIL";
        const error = entry.errorMessage ? ` -> ${entry.errorMessage}` : "";
        return ` ${icon} ${entry.index}. ${entry.toolName}${error}`;
      }),
      `${"=".repeat(50)}\n`,
    ]
      .filter((line) => line.length > 0)
      .join("\n");
  }
}
