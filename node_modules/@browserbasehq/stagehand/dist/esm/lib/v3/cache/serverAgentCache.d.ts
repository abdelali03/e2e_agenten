import type { V3 } from "../v3.js";
import type { AgentCacheTransferPayload } from "../types/private/index.js";
export interface ServerAgentCacheHandle {
    complete(): AgentCacheTransferPayload | null;
    discard(): void;
}
export declare function __internalCreateInMemoryAgentCacheHandle(stagehand: V3): ServerAgentCacheHandle;
