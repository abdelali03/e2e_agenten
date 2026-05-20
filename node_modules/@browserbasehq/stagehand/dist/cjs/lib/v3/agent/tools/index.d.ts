import { gotoTool } from "./goto.js";
import { actTool } from "./act.js";
import { screenshotTool } from "./screenshot.js";
import { waitTool } from "./wait.js";
import { navBackTool } from "./navback.js";
import { ariaTreeTool } from "./ariaTree.js";
import { fillFormTool } from "./fillform.js";
import { scrollTool, scrollVisionTool } from "./scroll.js";
import { extractTool } from "./extract.js";
import { clickTool } from "./click.js";
import { typeTool } from "./type.js";
import { dragAndDropTool } from "./dragAndDrop.js";
import { clickAndHoldTool } from "./clickAndHold.js";
import { keysTool } from "./keys.js";
import { fillFormVisionTool } from "./fillFormVision.js";
import { thinkTool } from "./think.js";
import { searchTool as browserbaseSearchTool } from "./browserbaseSearch.js";
import { searchTool as braveSearchTool } from "./braveSearch.js";
import type { ToolSet, InferUITools } from "ai";
import type { V3 } from "../../v3.js";
import type { LogLine } from "../../types/public/logs.js";
import type { AgentToolMode, AgentModelConfig, Variables } from "../../types/public/agent.js";
export interface V3AgentToolOptions {
    executionModel?: string | AgentModelConfig;
    logger?: (message: LogLine) => void;
    /**
     * Tool mode determines which set of tools are available.
     * - 'dom' (default): Uses DOM-based tools (act, fillForm) - removes coordinate-based tools
     * - 'hybrid': Uses coordinate-based tools (click, type, dragAndDrop, etc.) - removes fillForm
     */
    mode?: AgentToolMode;
    /**
     * The model provider. Used for model-specific coordinate handling
     */
    provider?: string;
    /**
     * Tools to exclude from the available toolset.
     * These tools will be filtered out after mode-based filtering.
     */
    excludeTools?: string[];
    /**
     * Variables available to the agent for use in act/type tools.
     * When provided, these tools will have an optional useVariable field.
     */
    variables?: Variables;
    /**
     * Timeout in milliseconds for async tool calls.
     * Applied to all tools that perform I/O (except wait and think).
     */
    toolTimeout?: number;
    /**
     * Whether to enable the Browserbase-powered web search tool.
     * Requires a valid Browserbase API key.
     */
    useSearch?: boolean;
    /**
     * The Browserbase API key used for the search tool.
     * Resolved from BROWSERBASE_API_KEY env var or the Stagehand constructor.
     */
    browserbaseApiKey?: string;
}
export declare function createAgentTools(v3: V3, options?: V3AgentToolOptions): ToolSet;
export type AgentTools = ReturnType<typeof createAgentTools>;
/**
 * Type map of all agent tools for strong typing of tool calls and results.
 * Note: `search` is optional — enabled via useSearch: true (Browserbase) or BRAVE_API_KEY env var (legacy).
 */
export type AgentToolTypesMap = {
    act: ReturnType<typeof actTool>;
    ariaTree: ReturnType<typeof ariaTreeTool>;
    click: ReturnType<typeof clickTool>;
    clickAndHold: ReturnType<typeof clickAndHoldTool>;
    dragAndDrop: ReturnType<typeof dragAndDropTool>;
    extract: ReturnType<typeof extractTool>;
    fillForm: ReturnType<typeof fillFormTool>;
    fillFormVision: ReturnType<typeof fillFormVisionTool>;
    goto: ReturnType<typeof gotoTool>;
    keys: ReturnType<typeof keysTool>;
    navback: ReturnType<typeof navBackTool>;
    screenshot: ReturnType<typeof screenshotTool>;
    scroll: ReturnType<typeof scrollTool> | ReturnType<typeof scrollVisionTool>;
    search?: ReturnType<typeof browserbaseSearchTool> | ReturnType<typeof braveSearchTool>;
    think: ReturnType<typeof thinkTool>;
    type: ReturnType<typeof typeTool>;
    wait: ReturnType<typeof waitTool>;
};
/**
 * Inferred UI tools type for type-safe tool inputs and outputs.
 * Use with UIMessage for full type safety in UI contexts.
 */
export type AgentUITools = InferUITools<AgentToolTypesMap>;
/**
 * Union type for all possible agent tool calls.
 * Provides type-safe access to tool call arguments.
 */
export type AgentToolCall = {
    [K in keyof AgentToolTypesMap]: {
        toolName: K;
        toolCallId: string;
        args: AgentUITools[K]["input"];
    };
}[keyof AgentToolTypesMap];
/**
 * Union type for all possible agent tool results.
 * Provides type-safe access to tool result values.
 */
export type AgentToolResult = {
    [K in keyof AgentToolTypesMap]: {
        toolName: K;
        toolCallId: string;
        result: AgentUITools[K]["output"];
    };
}[keyof AgentToolTypesMap];
