import type { V3 } from "../../v3.js";
import type { AgentToolMode, WaitToolResult } from "../../types/public/agent.js";
export declare const waitTool: (v3: V3, mode?: AgentToolMode) => import("ai").Tool<{
    timeMs: number;
}, WaitToolResult>;
