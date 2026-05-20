import { AgentAction } from "../../types/public/agent.js";
import { ActionMappingOptions } from "../../types/private/agent.js";
export declare function mapToolResultToActions({ toolCallName, toolResult, args, reasoning, }: ActionMappingOptions): AgentAction[];
