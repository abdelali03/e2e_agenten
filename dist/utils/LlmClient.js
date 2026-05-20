"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LlmClient = void 0;
const openai_1 = __importDefault(require("openai"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
class LlmClient {
    model;
    client;
    constructor() {
        this.model = process.env.LLM_MODEL || "llama-3.3-70b-versatile";
        if (!process.env.GROQ_API_KEY) {
            throw new Error("GROQ_API_KEY is missing in .env");
        }
        this.client = new openai_1.default({
            apiKey: process.env.GROQ_API_KEY,
            baseURL: "https://api.groq.com/openai/v1",
        });
    }
    async complete(messages, maxTokens = 4096) {
        try {
            return await this.completeWithJsonMode(messages, maxTokens);
        }
        catch (error) {
            if (this.isGroqJsonValidationError(error)) {
                console.warn("[LlmClient] Groq JSON validation failed. Retrying without response_format...");
                return await this.completeWithoutJsonMode(messages, maxTokens);
            }
            throw error;
        }
    }
    async completeWithJsonMode(messages, maxTokens) {
        const response = await this.client.chat.completions.create({
            model: this.model,
            messages,
            max_tokens: maxTokens,
            temperature: 0,
            response_format: { type: "json_object" },
        });
        return this.toLlmResponse(response);
    }
    async completeWithoutJsonMode(messages, maxTokens) {
        const safeMessages = [
            {
                role: "system",
                content: "You must respond with ONLY one valid JSON object. No markdown. No explanation. No code fences. No text before or after JSON.",
            },
            ...messages,
            {
                role: "user",
                content: "Return ONLY valid JSON now. Do not use markdown. Do not include explanations outside the JSON object.",
            },
        ];
        const response = await this.client.chat.completions.create({
            model: this.model,
            messages: safeMessages,
            max_tokens: maxTokens,
            temperature: 0,
        });
        return this.toLlmResponse(response);
    }
    toLlmResponse(response) {
        const content = response.choices[0]?.message?.content ?? "";
        if (!content.trim()) {
            throw new Error(`Groq returned empty response. model=${this.model}`);
        }
        return {
            content,
            model: response.model ?? this.model,
            usage: {
                promptTokens: response.usage?.prompt_tokens ?? 0,
                completionTokens: response.usage?.completion_tokens ?? 0,
            },
        };
    }
    isGroqJsonValidationError(error) {
        const err = error;
        return (err.status === 400 &&
            (err.code === "json_validate_failed" ||
                err.error?.code === "json_validate_failed" ||
                err.error?.type === "invalid_request_error" ||
                err.message?.includes("Failed to validate JSON") === true));
    }
    static parseJsonResponse(raw) {
        const cleaned = raw
            .replace(/^```json\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/```$/i, "")
            .trim();
        try {
            return JSON.parse(cleaned);
        }
        catch {
            const jsonStart = cleaned.indexOf("{");
            const jsonEnd = cleaned.lastIndexOf("}");
            if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
                throw new Error(`Could not parse JSON from LLM response: ${raw}`);
            }
            const extracted = cleaned.slice(jsonStart, jsonEnd + 1);
            return JSON.parse(extracted);
        }
    }
}
exports.LlmClient = LlmClient;
