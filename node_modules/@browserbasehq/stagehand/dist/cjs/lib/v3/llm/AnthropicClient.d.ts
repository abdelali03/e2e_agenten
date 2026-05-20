import { ClientOptions } from "@anthropic-ai/sdk";
import { LogLine } from "../types/public/logs.js";
import { AvailableModel } from "../types/public/model.js";
import { CreateChatCompletionOptions, LLMClient, LLMResponse } from "./LLMClient.js";
export declare class AnthropicClient extends LLMClient {
    type: "anthropic";
    private client;
    clientOptions: ClientOptions;
    constructor({ modelName, clientOptions, userProvidedInstructions, }: {
        logger: (message: LogLine) => void;
        modelName: AvailableModel;
        clientOptions?: ClientOptions;
        userProvidedInstructions?: string;
    });
    createChatCompletion<T = LLMResponse>({ options, retries, logger, }: CreateChatCompletionOptions): Promise<T>;
}
