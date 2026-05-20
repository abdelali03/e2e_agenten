import { LLMTool } from "../types/public/model.js";
import { embed, embedMany, experimental_generateImage, experimental_generateSpeech, experimental_transcribe, generateObject, generateText, streamObject, streamText } from "ai";
import type { LanguageModelV2 } from "@ai-sdk/provider";
import { LogLine } from "../types/public/logs.js";
import { AvailableModel, ClientOptions } from "../types/public/model.js";
import type { StagehandZodSchema } from "../zodCompat.js";
export interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: ChatMessageContent;
}
export type ChatMessageContent = string | (ChatMessageImageContent | ChatMessageTextContent)[];
export interface ChatMessageImageContent {
    type: string;
    image_url?: {
        url: string;
    };
    text?: string;
    source?: {
        type: string;
        media_type: string;
        data: string;
    };
}
export interface ChatMessageTextContent {
    type: string;
    text: string;
}
export declare const AnnotatedScreenshotText = "This is a screenshot of the current page state with the elements annotated on it. Each element id is annotated with a number to the top left of it. Duplicate annotations at the same location are under each other vertically.";
export interface ChatCompletionOptions {
    messages: ChatMessage[];
    temperature?: number;
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
    image?: {
        buffer: Buffer;
        description?: string;
    };
    response_model?: {
        name: string;
        schema: StagehandZodSchema;
    };
    tools?: LLMTool[];
    tool_choice?: "auto" | "none" | "required";
    maxOutputTokens?: number;
    requestId?: string;
}
export type LLMResponse = {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: {
        index: number;
        message: {
            role: string;
            content: string | null;
            tool_calls: {
                id: string;
                type: string;
                function: {
                    name: string;
                    arguments: string;
                };
            }[];
        };
        finish_reason: string;
    }[];
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
};
export interface CreateChatCompletionOptions {
    options: ChatCompletionOptions;
    logger: (message: LogLine) => void;
    retries?: number;
}
/** Simple usage shape if your LLM returns usage tokens. */
export interface LLMUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    reasoning_tokens?: number;
    cached_input_tokens?: number;
}
/**
 * For calls that use a schema: the LLMClient may return { data: T; usage?: LLMUsage }
 */
export interface LLMParsedResponse<T> {
    data: T;
    usage?: LLMUsage;
}
export declare abstract class LLMClient {
    type: "openai" | "anthropic" | "cerebras" | "groq" | (string & {});
    modelName: AvailableModel | (string & {});
    hasVision: boolean;
    clientOptions: ClientOptions;
    userProvidedInstructions?: string;
    constructor(modelName: AvailableModel, userProvidedInstructions?: string);
    abstract createChatCompletion<T>(options: CreateChatCompletionOptions & {
        options: {
            response_model: {
                name: string;
                schema: StagehandZodSchema;
            };
        };
    }): Promise<LLMParsedResponse<T>>;
    abstract createChatCompletion<T = LLMResponse>(options: CreateChatCompletionOptions): Promise<T>;
    generateObject: typeof generateObject;
    generateText: typeof generateText;
    streamText: typeof streamText;
    streamObject: typeof streamObject;
    generateImage: typeof experimental_generateImage;
    embed: typeof embed;
    embedMany: typeof embedMany;
    transcribe: typeof experimental_transcribe;
    generateSpeech: typeof experimental_generateSpeech;
    getLanguageModel?(): LanguageModelV2;
}
