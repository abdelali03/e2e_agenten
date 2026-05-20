import type { LLMClient } from "../llm/LLMClient.js";
import type { AgentReplayStep, SanitizedAgentExecuteOptions, AgentCacheContext, AgentCacheDeps, AgentCacheTransferPayload } from "../types/private/index.js";
import type { AgentResult, AgentStreamResult, AgentConfig, AgentExecuteOptionsBase } from "../types/public/index.js";
import type { Page } from "../understudy/page.js";
export declare class AgentCache {
    private readonly storage;
    private readonly logger;
    private readonly getActHandler;
    private readonly getContext;
    private readonly getDefaultLlmClient;
    private readonly getBaseModelName;
    private readonly getSystemPrompt;
    private readonly domSettleTimeoutMs?;
    private readonly act;
    private readonly bufferLatestEntry;
    private recording;
    private latestEntry;
    constructor({ storage, logger, getActHandler, getContext, getDefaultLlmClient, getBaseModelName, getSystemPrompt, domSettleTimeoutMs, act, bufferLatestEntry, }: AgentCacheDeps);
    get enabled(): boolean;
    shouldAttemptCache(instruction: string): boolean;
    sanitizeExecuteOptions(options?: AgentExecuteOptionsBase): SanitizedAgentExecuteOptions;
    buildConfigSignature(agentOptions?: AgentConfig): string;
    prepareContext(params: {
        instruction: string;
        options: SanitizedAgentExecuteOptions;
        configSignature: string;
        page: Page;
        variables?: Record<string, string>;
    }): Promise<AgentCacheContext | null>;
    tryReplay(context: AgentCacheContext, llmClientOverride?: LLMClient): Promise<AgentResult | null>;
    /**
     * Attempts to replay a cached agent execution and returns it as a stream result.
     *
     * This method exists because the agent API exposes two execution modes:
     * - `execute()` - Returns a Promise<AgentResult> directly
     * - `stream()` - Returns an AgentStreamResult with async iterables for real-time output
     *
     * When a cache hit occurs, we need to return the appropriate type for each mode:
     * - For `execute()`, we use `tryReplay()` which returns AgentResult
     * - For `stream()`, we use `tryReplayAsStream()` which wraps the result in a
     *   stream-compatible interface
     *
     * This ensures consumers using `stream()` can still iterate over `textStream`
     * and await `result` even when the response comes from cache, maintaining
     * API consistency regardless of whether the result was cached or live.
     */
    tryReplayAsStream(context: AgentCacheContext, llmClientOverride?: LLMClient): Promise<AgentStreamResult | null>;
    /**
     * Creates a mock AgentStreamResult that wraps a cached AgentResult.
     *
     * AgentStreamResult (from the AI SDK) is a complex type with multiple async
     * iterables and promises. When serving from cache, we don't have an actual
     * LLM stream to consume - we just have the final result. This method creates
     * a "fake" stream
  
     * This approach lets cached responses be transparent to the consumer -
     * they can use the same iteration patterns whether the result is live or cached.
     */
    private createCachedStreamResult;
    /**
     * Wraps an AgentStreamResult with caching logic.
     *
     * This method handles the complexity of caching for streaming responses:
     * 1. Begins recording agent replay steps
     * 2. Wraps the stream's result promise to capture completion
     * 3. On success: ends recording and stores the cache entry
     * 4. On error: discards the recording
     *
     * This keeps the caching orchestration in AgentCache rather than
     * spreading it across the V3 class.
     *
     * @param context - The cache context for this execution
     * @param streamResult - The stream result from the agent handler
     * @param beginRecording - Callback to start recording (from V3)
     * @param endRecording - Callback to end recording and get steps (from V3)
     * @param discardRecording - Callback to discard recording on error (from V3)
     * @returns The wrapped stream result with caching enabled
     */
    wrapStreamForCaching(context: AgentCacheContext, streamResult: AgentStreamResult, beginRecording: () => void, endRecording: () => AgentReplayStep[], discardRecording: () => void): AgentStreamResult;
    store(context: AgentCacheContext, steps: AgentReplayStep[], result: AgentResult): Promise<void>;
    consumeBufferedEntry(): AgentCacheTransferPayload | null;
    storeTransferredEntry(payload: AgentCacheTransferPayload | null): Promise<void>;
    /**
     * Clone the agent result and prune bulky fields (e.g. screenshot base64 blobs)
     * before persisting it to disk. This keeps cache entries compact without
     * mutating the live AgentResult returned to callers.
     */
    private pruneAgentResult;
    beginRecording(): void;
    endRecording(): AgentReplayStep[];
    discardRecording(): void;
    isRecording(): boolean;
    recordStep(step: AgentReplayStep): void;
    isReplayActive(): boolean;
    private serializeAgentModelForCache;
    private buildAgentCacheKey;
    private sanitizeModelOptionsForCache;
    private sanitizeModelValueForCache;
    private replayAgentCacheEntry;
    private executeAgentReplayStep;
    private replayAgentActStep;
    private replayAgentFillFormStep;
    private replayAgentGotoStep;
    private replayAgentScrollStep;
    private replayAgentWaitStep;
    private replayAgentNavBackStep;
    private replayAgentKeysStep;
    private haveActionsChanged;
    private refreshAgentCacheEntry;
}
