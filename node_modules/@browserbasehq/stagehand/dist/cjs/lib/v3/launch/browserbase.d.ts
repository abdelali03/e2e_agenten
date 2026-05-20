import Browserbase from "@browserbasehq/sdk";
import type { BrowserbaseSessionCreateParams } from "../types/public/api.js";
export declare function createBrowserbaseSession(apiKey: string, projectId?: string, params?: BrowserbaseSessionCreateParams, resumeSessionId?: string): Promise<{
    ws: string;
    sessionId: string;
    bb: Browserbase;
}>;
