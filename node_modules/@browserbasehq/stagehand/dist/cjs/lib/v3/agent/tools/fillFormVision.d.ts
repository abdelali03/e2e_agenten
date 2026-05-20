import type { V3 } from "../../v3.js";
import type { FillFormVisionToolResult, Variables } from "../../types/public/agent.js";
export declare const fillFormVisionTool: (v3: V3, provider?: string, variables?: Variables) => import("ai").Tool<{
    fields: {
        action: string;
        value: string;
        coordinates: {
            x: number;
            y: number;
        };
    }[];
}, FillFormVisionToolResult>;
