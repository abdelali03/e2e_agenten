import { V3FunctionName } from "../types/public/methods.js";
import { LLMClient } from "../llm/LLMClient.js";
import { ExtractHandlerParams } from "../types/private/handlers.js";
import { ZodPathSegments } from "../types/private/internal.js";
import { AvailableModel, ClientOptions, ModelConfiguration } from "../types/public/model.js";
import type { InferStagehandSchema, StagehandZodSchema } from "../zodCompat.js";
/**
 * Scans the provided Zod schema for any `z.string().url()` fields and
 * replaces them with `z.number()`.
 *
 * @param schema - The Zod object schema to transform.
 * @returns A tuple containing:
 *   1. The transformed schema (or the original schema if no changes were needed).
 *   2. An array of {@link ZodPathSegments} objects representing all the replaced URL fields,
 *      with each path segment showing where in the schema the replacement occurred.
 */
export declare function transformUrlStringsToNumericIds<T extends StagehandZodSchema>(schema: T): [StagehandZodSchema, ZodPathSegments[]];
export declare class ExtractHandler {
    private readonly llmClient;
    private readonly defaultModelName;
    private readonly defaultClientOptions;
    private readonly resolveLlmClient;
    private readonly systemPrompt;
    private readonly logInferenceToFile;
    private readonly experimental;
    private readonly onMetrics?;
    constructor(llmClient: LLMClient, defaultModelName: AvailableModel, defaultClientOptions: ClientOptions, resolveLlmClient: (model?: ModelConfiguration) => LLMClient, systemPrompt?: string, logInferenceToFile?: boolean, experimental?: boolean, onMetrics?: (functionName: V3FunctionName, promptTokens: number, completionTokens: number, reasoningTokens: number, cachedInputTokens: number, inferenceTimeMs: number) => void);
    extract<T extends StagehandZodSchema>(params: ExtractHandlerParams<T>): Promise<InferStagehandSchema<T> | {
        pageText: string;
    }>;
}
