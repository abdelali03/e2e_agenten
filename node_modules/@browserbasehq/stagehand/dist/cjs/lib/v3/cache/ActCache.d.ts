import type { LLMClient } from "../llm/LLMClient.js";
import type { ActResult } from "../types/public/index.js";
import type { Page } from "../understudy/page.js";
import { ActCacheContext, ActCacheDeps } from "../types/private/index.js";
export declare class ActCache {
    private readonly storage;
    private readonly logger;
    private readonly getActHandler;
    private readonly getDefaultLlmClient;
    private readonly domSettleTimeoutMs?;
    constructor({ storage, logger, getActHandler, getDefaultLlmClient, domSettleTimeoutMs, }: ActCacheDeps);
    get enabled(): boolean;
    prepareContext(instruction: string, page: Page, variables?: Record<string, string>): Promise<ActCacheContext | null>;
    tryReplay(context: ActCacheContext, page: Page, timeout?: number, llmClientOverride?: LLMClient): Promise<ActResult | null>;
    store(context: ActCacheContext, result: ActResult): Promise<void>;
    private buildActCacheKey;
    private replayCachedActions;
    private haveActionsChanged;
    private refreshCacheEntry;
    private doVariableKeysMatch;
    private hasAllVariableValues;
}
