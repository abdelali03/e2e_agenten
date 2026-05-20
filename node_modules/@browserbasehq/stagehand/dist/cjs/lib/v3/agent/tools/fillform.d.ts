import type { V3 } from "../../v3.js";
import type { Action } from "../../types/public/methods.js";
import type { AgentModelConfig, Variables } from "../../types/public/agent.js";
export declare const fillFormTool: (v3: V3, executionModel?: string | AgentModelConfig, variables?: Variables, toolTimeout?: number) => import("ai").Tool<{
    fields: {
        action: string;
    }[];
}, {
    success: boolean;
    actions: unknown[];
    playwrightArguments: Action[];
    error?: undefined;
} | {
    success: boolean;
    error: any;
    actions?: undefined;
    playwrightArguments?: undefined;
}>;
