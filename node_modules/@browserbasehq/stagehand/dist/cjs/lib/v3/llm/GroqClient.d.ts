import type { ClientOptions } from "openai";
import { LogLine } from "../types/public/logs.js";
import { AvailableModel } from "../types/public/model.js";
import { CreateChatCompletionOptions, LLMClient, LLMResponse } from "./LLMClient.js";
export declare class GroqClient extends LLMClient {
    type: "groq";
    private client;
    clientOptions: ClientOptions;
    hasVision: boolean;
    constructor({ modelName, clientOptions, userProvidedInstructions, }: {
        logger: (message: LogLine) => void;
        modelName: AvailableModel;
        clientOptions?: ClientOptions;
        userProvidedInstructions?: string;
    });
    createChatCompletion<T = LLMResponse>({ options, retries, logger, }: CreateChatCompletionOptions): Promise<T>;
}
