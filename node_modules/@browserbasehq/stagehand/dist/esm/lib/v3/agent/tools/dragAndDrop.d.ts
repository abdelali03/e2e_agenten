import type { V3 } from "../../v3.js";
import type { DragAndDropToolResult } from "../../types/public/agent.js";
export declare const dragAndDropTool: (v3: V3, provider?: string) => import("ai").Tool<{
    describe: string;
    startCoordinates: number[];
    endCoordinates: number[];
}, DragAndDropToolResult>;
