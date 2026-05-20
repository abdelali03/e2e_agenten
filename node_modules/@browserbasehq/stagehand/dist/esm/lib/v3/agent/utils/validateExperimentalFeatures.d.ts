import type { AgentConfig, AgentExecuteOptionsBase } from "../../types/public/index.js";
export interface AgentValidationOptions {
    /** Whether experimental mode is enabled */
    isExperimental: boolean;
    /** Agent config options (integrations, tools, stream, cua, etc.) */
    agentConfig?: Partial<AgentConfig>;
    /** Execute options (callbacks, signal, messages, etc.) */
    executeOptions?: (Partial<AgentExecuteOptionsBase> & {
        callbacks?: unknown;
    }) | null;
    /** Whether this is streaming mode (can be derived from agentConfig.stream) */
    isStreaming?: boolean;
}
/**
 * Validates agent configuration and experimental feature usage.
 *
 * This utility consolidates all validation checks for both CUA and non-CUA agent paths:
 * - Invalid argument errors for CUA (streaming, abort signal, message continuation, excludeTools, output schema are not supported)
 * - Experimental feature checks for integrations and tools (both CUA and non-CUA)
 * - Experimental feature checks for hybrid mode (requires experimental: true)
 * - Experimental feature checks for non-CUA only (callbacks, signal, messages, streaming, excludeTools, output schema)
 *
 * Throws StagehandInvalidArgumentError for invalid/unsupported configurations.
 * Throws ExperimentalNotConfiguredError if experimental features are used without experimental mode.
 */
export declare function validateExperimentalFeatures(options: AgentValidationOptions): void;
