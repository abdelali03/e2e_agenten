import { ActHandlerParams } from "../types/private/handlers.js";
import { ActResult, Action, V3FunctionName } from "../types/public/methods.js";
import { LLMClient } from "../llm/LLMClient.js";
import { AvailableModel, ClientOptions, ModelConfiguration } from "../types/public/model.js";
import type { Variables } from "../types/public/agent.js";
import type { Page } from "../understudy/page.js";
export declare class ActHandler {
    private readonly llmClient;
    private readonly defaultModelName;
    private readonly defaultClientOptions;
    private readonly resolveLlmClient;
    private readonly systemPrompt;
    private readonly logInferenceToFile;
    private readonly selfHeal;
    private readonly onMetrics?;
    private readonly defaultDomSettleTimeoutMs?;
    constructor(llmClient: LLMClient, defaultModelName: AvailableModel, defaultClientOptions: ClientOptions, resolveLlmClient: (model?: ModelConfiguration) => LLMClient, systemPrompt?: string, logInferenceToFile?: boolean, selfHeal?: boolean, onMetrics?: (functionName: V3FunctionName, promptTokens: number, completionTokens: number, reasoningTokens: number, cachedInputTokens: number, inferenceTimeMs: number) => void, defaultDomSettleTimeoutMs?: number);
    private recordActMetrics;
    private getActionFromLLM;
    act(params: ActHandlerParams): Promise<ActResult>;
    takeDeterministicAction(action: Action, page: Page, domSettleTimeoutMs?: number, llmClientOverride?: LLMClient, ensureTimeRemaining?: () => void, variables?: Variables): Promise<ActResult>;
}
