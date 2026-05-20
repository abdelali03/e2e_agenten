import { ClientOptions } from "openai";
import { LogLine } from "../types/public/logs.js";
import { AvailableModel } from "../types/public/model.js";
import { CreateChatCompletionOptions, LLMClient, LLMResponse } from "./LLMClient.js";
export declare class OpenAIClient extends LLMClient {
    type: "openai";
    private client;
    clientOptions: ClientOptions;
    constructor({ modelName, clientOptions, }: {
        logger: (message: LogLine) => void;
        modelName: AvailableModel;
        clientOptions?: ClientOptions;
    });
    createChatCompletion<T = LLMResponse>({ options: optionsInitial, logger, retries, }: CreateChatCompletionOptions): Promise<T>;
}
