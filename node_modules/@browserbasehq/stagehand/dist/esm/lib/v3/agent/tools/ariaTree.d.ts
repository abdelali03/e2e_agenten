import type { V3 } from "../../v3.js";
export declare const ariaTreeTool: (v3: V3, toolTimeout?: number) => import("ai").Tool<Record<string, never>, {
    success: boolean;
    content: string;
    pageUrl: string;
    error?: undefined;
} | {
    content: string;
    error: any;
    success: boolean;
    pageUrl: string;
}>;
