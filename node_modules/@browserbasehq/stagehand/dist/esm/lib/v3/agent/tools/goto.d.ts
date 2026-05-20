import type { V3 } from "../../v3.js";
export declare const gotoTool: (v3: V3) => import("ai").Tool<{
    url: string;
}, {
    success: boolean;
    url: string;
    error?: undefined;
} | {
    success: boolean;
    error: any;
    url?: undefined;
}>;
