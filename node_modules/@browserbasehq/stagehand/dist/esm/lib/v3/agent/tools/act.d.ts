import type { V3 } from "../../v3.js";
import type { Action } from "../../types/public/methods.js";
import type { AgentModelConfig, Variables } from "../../types/public/agent.js";
export declare const actTool: (v3: V3, executionModel?: string | AgentModelConfig, variables?: Variables, toolTimeout?: number) => import("ai").Tool<{
    action: string;
}, {
    success: boolean;
    action: string;
    playwrightArguments?: Action;
} | {
    success: boolean;
    error: any;
}>;
