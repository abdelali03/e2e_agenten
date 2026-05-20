import type { V3 } from "../../v3.js";
import type { ClickToolResult } from "../../types/public/agent.js";
export declare const clickTool: (v3: V3, provider?: string) => import("ai").Tool<{
    describe: string;
    coordinates: number[];
}, ClickToolResult>;
