import type { V3 } from "../../v3.js";
import type { TypeToolResult, Variables } from "../../types/public/agent.js";
export declare const typeTool: (v3: V3, provider?: string, variables?: Variables) => import("ai").Tool<{
    describe: string;
    text: string;
    coordinates: number[];
}, TypeToolResult>;
