import type { V3 } from "../../v3.js";
export interface BraveSearchResult {
    title: string;
    url: string;
    description?: string;
}
export declare const searchTool: (v3: V3) => import("ai").Tool<{
    query: string;
}, {
    timestamp: number;
    data?: {
        results: BraveSearchResult[];
    };
    error?: string;
}>;
