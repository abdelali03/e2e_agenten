import type { V3 } from "../../v3.js";
export declare const clickAndHoldTool: (v3: V3, provider?: string) => import("ai").Tool<{
    describe: string;
    duration: number;
    coordinates: number[];
}, {
    success: boolean;
    describe: string;
    error?: undefined;
} | {
    success: boolean;
    error: string;
    describe?: undefined;
}>;
