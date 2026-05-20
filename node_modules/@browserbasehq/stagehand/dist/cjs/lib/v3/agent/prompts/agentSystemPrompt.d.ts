import type { AgentToolMode, Variables } from "../../types/public/agent.js";
export interface AgentSystemPromptOptions {
    url: string;
    executionInstruction: string;
    mode: AgentToolMode;
    systemInstructions?: string;
    /** Whether captchas are automatically solved by the browser environment */
    captchasAutoSolve?: boolean;
    /** Tools to exclude from the system prompt */
    excludeTools?: string[];
    /** Variables available to the agent for use in act/type tools */
    variables?: Variables;
    /** Whether the search tool is enabled for this execution */
    useSearch?: boolean;
}
export declare function buildAgentSystemPrompt(options: AgentSystemPromptOptions): string;
