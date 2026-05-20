import type { V3 } from "../../lib/v3/v3.js";
import type { LanguageModelV2CallOptions, LanguageModelV2Content, LanguageModelV2FinishReason, LanguageModelV2Usage } from "@ai-sdk/provider";
import { AISdkClient } from "../../lib/v3/llm/aisdk.js";
/**
 * Races a promise against a timeout.
 * Resolves to the promise value or "timeout" if the deadline expires.
 */
export declare function raceTimeout<T>(promise: Promise<T>, ms: number): Promise<T | "timeout">;
export declare function closeV3(v3?: V3 | null): Promise<void>;
type JsonResponseKey = "act" | "Observation" | "Metadata" | "Extraction" | "default";
type JsonResponseValue = Record<string, unknown> | ((options: LanguageModelV2CallOptions) => Record<string, unknown>);
type JsonResponseScript = JsonResponseValue | JsonResponseValue[];
type GenerateResponseValue = {
    content: LanguageModelV2Content[];
    finishReason?: LanguageModelV2FinishReason;
    usage?: Partial<LanguageModelV2Usage>;
} | ((options: LanguageModelV2CallOptions) => {
    content: LanguageModelV2Content[];
    finishReason?: LanguageModelV2FinishReason;
    usage?: Partial<LanguageModelV2Usage>;
});
export declare function promptToText(prompt: LanguageModelV2CallOptions["prompt"]): string;
export declare function findEncodedIdForText(options: LanguageModelV2CallOptions, text: string): string;
export declare function findLastEncodedId(options: LanguageModelV2CallOptions): string;
export declare function toolCallResponse(toolName: string, input: Record<string, unknown>, toolCallId?: string): {
    content: LanguageModelV2Content[];
    finishReason: LanguageModelV2FinishReason;
    usage: LanguageModelV2Usage;
};
export declare function doneToolResponse(reasoning?: string, taskComplete?: boolean, toolCallId?: string): {
    content: LanguageModelV2Content[];
    finishReason: LanguageModelV2FinishReason;
    usage: LanguageModelV2Usage;
};
export declare function createScriptedAisdkTestLlmClient(options?: {
    modelId?: string;
    jsonResponses?: Partial<Record<JsonResponseKey, JsonResponseScript>>;
    generateResponses?: GenerateResponseValue[];
}): AISdkClient;
export {};
