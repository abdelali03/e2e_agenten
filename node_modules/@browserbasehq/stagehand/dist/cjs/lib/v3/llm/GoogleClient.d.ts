import { LogLine } from "../types/public/logs.js";
import { AvailableModel, ClientOptions } from "../types/public/model.js";
import { CreateChatCompletionOptions, LLMClient, LLMResponse } from "./LLMClient.js";
export declare class GoogleClient extends LLMClient {
    type: "google";
    private client;
    clientOptions: ClientOptions;
    hasVision: boolean;
    private logger;
    constructor({ logger, // Added logger based on other clients
    modelName, clientOptions, }: {
        logger: (message: LogLine) => void;
        modelName: AvailableModel;
        clientOptions?: ClientOptions;
    });
    private formatMessages;
    private formatTools;
    createChatCompletion<T = LLMResponse>({ options, logger, retries, }: CreateChatCompletionOptions): Promise<T>;
}
