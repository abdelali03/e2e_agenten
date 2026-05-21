import OpenAI from "openai";
import dotenv from "dotenv";
import type { LlmProvider } from "../core/types";

dotenv.config();

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmResponse {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
  };
}

export class LlmClient {
  private readonly provider: LlmProvider;
  private readonly model: string;
  private readonly client: OpenAI;

  constructor() {
    this.provider = this.getProvider();
    const config = this.getProviderConfig(this.provider);

    this.model = process.env.LLM_MODEL || config.defaultModel;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      defaultHeaders: config.defaultHeaders,
    });
  }

  public async complete(
    messages: LlmMessage[],
    maxTokens = 4096
  ): Promise<LlmResponse> {
    try {
      return await this.completeWithJsonMode(messages, maxTokens);
    } catch (error) {
      if (this.shouldRetryWithoutJsonMode(error)) {
        console.warn(
          `[LlmClient] ${this.provider} JSON mode failed. Retrying without response_format...`
        );

        return await this.completeWithoutJsonMode(messages, maxTokens);
      }

      throw error;
    }
  }

  private async completeWithJsonMode(
    messages: LlmMessage[],
    maxTokens: number
  ): Promise<LlmResponse> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      max_tokens: maxTokens,
      temperature: 0,
      response_format: { type: "json_object" },
    });

    return this.toLlmResponse(response);
  }

  private async completeWithoutJsonMode(
    messages: LlmMessage[],
    maxTokens: number
  ): Promise<LlmResponse> {
    const safeMessages: LlmMessage[] = [
      {
        role: "system",
        content:
          "You must respond with ONLY one valid JSON object. No markdown. No explanation. No code fences. No <think> blocks. No text before or after JSON.",
      },
      ...messages,
      {
        role: "user",
        content:
          "Return ONLY valid JSON now. Do not use markdown. Do not include explanations or <think> blocks outside the JSON object.",
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

  private toLlmResponse(response: OpenAI.Chat.Completions.ChatCompletion): LlmResponse {
    const content = response.choices[0]?.message?.content ?? "";

    if (!content.trim()) {
      throw new Error(
        `${this.provider} returned empty response. model=${this.model}`
      );
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

  private getProvider(): LlmProvider {
    const provider = (process.env.LLM_PROVIDER || "groq").toLowerCase();

    if (
      provider === "groq" ||
      provider === "openrouter" ||
      provider === "minimax"
    ) {
      return provider;
    }

    throw new Error(
      `Unsupported LLM_PROVIDER="${process.env.LLM_PROVIDER}". Use "groq", "openrouter", or "minimax".`
    );
  }

  private getProviderConfig(provider: LlmProvider): {
    apiKey: string;
    baseURL: string;
    defaultModel: string;
    defaultHeaders?: Record<string, string>;
  } {
    if (provider === "groq") {
      if (!process.env.GROQ_API_KEY) {
        throw new Error("GROQ_API_KEY is missing in .env");
      }

      return {
        apiKey: process.env.GROQ_API_KEY,
        baseURL: process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
        defaultModel: "llama-3.3-70b-versatile",
      };
    }

    if (provider === "minimax") {
      if (!process.env.MINIMAX_API_KEY) {
        throw new Error("MINIMAX_API_KEY is missing in .env");
      }

      return {
        apiKey: process.env.MINIMAX_API_KEY,
        baseURL: process.env.MINIMAX_BASE_URL || "https://api.minimax.io/v1",
        defaultModel: "MiniMax-M2.7",
      };
    }

    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY is missing in .env");
    }

    return {
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL:
        process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
      defaultModel: "meta-llama/llama-3.3-70b-instruct",
      defaultHeaders: this.getOpenRouterHeaders(),
    };
  }

  private getOpenRouterHeaders(): Record<string, string> | undefined {
    const headers: Record<string, string> = {};

    if (process.env.OPENROUTER_SITE_URL) {
      headers["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL;
    }

    if (process.env.OPENROUTER_APP_NAME) {
      headers["X-Title"] = process.env.OPENROUTER_APP_NAME;
    }

    return Object.keys(headers).length > 0 ? headers : undefined;
  }

  private shouldRetryWithoutJsonMode(error: unknown): boolean {
    const err = error as {
      code?: string;
      error?: {
        code?: string;
        type?: string;
        message?: string;
      };
      message?: string;
      status?: number;
    };

    return (
      (err.status === 400 || err.status === 422) &&
      (
        err.code === "json_validate_failed" ||
        err.error?.code === "json_validate_failed" ||
        err.error?.type === "invalid_request_error" ||
        err.message?.includes("Failed to validate JSON") === true ||
        err.message?.includes("response_format") === true ||
        err.error?.message?.includes("response_format") === true
      )
    );
  }

  public static parseJsonResponse<T>(raw: string): T {
    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .trim();

    try {
      return JSON.parse(cleaned) as T;
    } catch {
      const extracted = this.extractFirstJsonObject(cleaned);

      if (!extracted) {
        throw new Error(`Could not parse JSON from LLM response: ${raw}`);
      }

      return JSON.parse(extracted) as T;
    }
  }

  private static extractFirstJsonObject(raw: string): string | null {
    const start = raw.indexOf("{");

    if (start === -1) {
      return null;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < raw.length; index += 1) {
      const char = raw[index];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === "\"") {
        inString = !inString;
        continue;
      }

      if (inString) {
        continue;
      }

      if (char === "{") {
        depth += 1;
      } else if (char === "}") {
        depth -= 1;

        if (depth === 0) {
          return raw.slice(start, index + 1);
        }
      }
    }

    return null;
  }
}
