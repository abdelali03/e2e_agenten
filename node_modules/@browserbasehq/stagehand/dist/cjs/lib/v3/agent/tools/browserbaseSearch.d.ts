import type { V3 } from "../../v3.js";
export interface SearchResult {
    title: string;
    url: string;
    publishedDate?: string;
}
export declare const searchTool: (v3: V3, apiKey: string) => import("ai").Tool<{
    query: string;
}, {
    timestamp: number;
    results: SearchResult[];
    error?: string;
}>;
