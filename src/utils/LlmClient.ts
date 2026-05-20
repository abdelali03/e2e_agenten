import OpenAI from "openai";
import dotenv from "dotenv";

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
  private readonly model: string;
  private readonly client: OpenAI;

  constructor() {
    this.model = process.env.LLM_MODEL || "llama-3.3-70b-versatile";

    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY is missing in .env");
    }

    this.client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    });
  }

  public async complete(
    messages: LlmMessage[],
    maxTokens = 4096
  ): Promise<LlmResponse> {
    try {
      return await this.completeWithJsonMode(messages, maxTokens);
    } catch (error) {
      if (this.isGroqJsonValidationError(error)) {
        console.warn(
          "[LlmClient] Groq JSON validation failed. Retrying without response_format..."
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
          "You must respond with ONLY one valid JSON object. No markdown. No explanation. No code fences. No text before or after JSON.",
      },
      ...messages,
      {
        role: "user",
        content:
          "Return ONLY valid JSON now. Do not use markdown. Do not include explanations outside the JSON object.",
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

  private isGroqJsonValidationError(error: unknown): boolean {
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
      err.status === 400 &&
      (
        err.code === "json_validate_failed" ||
        err.error?.code === "json_validate_failed" ||
        err.error?.type === "invalid_request_error" ||
        err.message?.includes("Failed to validate JSON") === true
      )
    );
  }

  public static parseJsonResponse<T>(raw: string): T {
    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();

    try {
      return JSON.parse(cleaned) as T;
    } catch {
      const jsonStart = cleaned.indexOf("{");
      const jsonEnd = cleaned.lastIndexOf("}");

      if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
        throw new Error(`Could not parse JSON from LLM response: ${raw}`);
      }

      const extracted = cleaned.slice(jsonStart, jsonEnd + 1);
      return JSON.parse(extracted) as T;
    }
  }
}