import type { LanguageModelV2 } from "@ai-sdk/provider";
import { CreateChatCompletionOptions, LLMClient } from "../llm/LLMClient.js";
import { ChatCompletion } from "openai/resources";
export declare class AISdkClient extends LLMClient {
    type: "aisdk";
    private model;
    constructor({ model }: {
        model: LanguageModelV2;
    });
    createChatCompletion<T = ChatCompletion>({ options, }: CreateChatCompletionOptions): Promise<T>;
}
