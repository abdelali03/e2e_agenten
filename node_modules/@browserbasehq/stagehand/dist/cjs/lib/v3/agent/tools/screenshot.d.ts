import type { V3 } from "../../v3.js";
export declare const screenshotTool: (v3: V3) => import("ai").Tool<Record<string, never>, {
    success: boolean;
    base64: string;
    timestamp: number;
    pageUrl: string;
    error?: undefined;
} | {
    success: boolean;
    error: string;
    base64?: undefined;
    timestamp?: undefined;
    pageUrl?: undefined;
}>;
