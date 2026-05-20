import { V3FunctionName } from "../types/public/methods.js";
import { LLMClient } from "../llm/LLMClient.js";
import { ObserveHandlerParams } from "../types/private/handlers.js";
import { Action } from "../types/public/methods.js";
import { AvailableModel, ClientOptions, ModelConfiguration } from "../types/public/model.js";
export declare class ObserveHandler {
    private readonly llmClient;
    private readonly defaultModelName;
    private readonly defaultClientOptions;
    private readonly resolveLlmClient;
    private readonly systemPrompt;
    private readonly logInferenceToFile;
    private readonly experimental;
    private readonly onMetrics?;
    constructor(llmClient: LLMClient, defaultModelName: AvailableModel, defaultClientOptions: ClientOptions, resolveLlmClient: (model?: ModelConfiguration) => LLMClient, systemPrompt?: string, logInferenceToFile?: boolean, experimental?: boolean, onMetrics?: (functionName: V3FunctionName, promptTokens: number, completionTokens: number, reasoningTokens: number, cachedInputTokens: number, inferenceTimeMs: number) => void);
    observe(params: ObserveHandlerParams): Promise<Action[]>;
}
