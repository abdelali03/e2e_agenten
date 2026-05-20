import type { LanguageModelV2 } from "@ai-sdk/provider";
import { ChatCompletion } from "openai/resources";
import { LogLine } from "../types/public/logs.js";
import { ClientOptions } from "../types/public/model.js";
import { CreateChatCompletionOptions, LLMClient } from "./LLMClient.js";
export declare class AISdkClient extends LLMClient {
    type: "aisdk";
    private model;
    private logger?;
    constructor({ model, logger, clientOptions, }: {
        model: LanguageModelV2;
        logger?: (message: LogLine) => void;
        clientOptions?: ClientOptions;
    });
    getLanguageModel(): LanguageModelV2;
    createChatCompletion<T = ChatCompletion>({ options, }: CreateChatCompletionOptions): Promise<T>;
}
