import type { LanguageModelMiddleware } from "ai";
import { z } from "zod";
import { EventEmitterWithWildcardSupport } from "./EventEmitter.js";
export declare const FlowEventDataSchema: z.ZodRecord<z.ZodString, z.ZodUnknown>;
export declare const FlowEventInputSchema: z.ZodObject<{
    eventType: z.ZodString;
    eventId: z.ZodOptional<z.ZodString>;
    eventParentIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    eventCreatedAt: z.ZodOptional<z.ZodString>;
    sessionId: z.ZodOptional<z.ZodString>;
    data: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export type FlowEventData = z.infer<typeof FlowEventDataSchema>;
export type FlowEventInput = z.input<typeof FlowEventInputSchema>;
type FlowEventFields = Omit<FlowEventInput, "eventId" | "eventParentIds" | "eventCreatedAt" | "sessionId" | "data"> & {
    eventId: string;
    eventParentIds: string[];
    eventCreatedAt: string;
    sessionId: string;
    data: FlowEventData;
};
export declare class FlowEvent implements FlowEventFields {
    private static deriveEventIdSuffix;
    static createEventId(eventType: string): string;
    eventType: string;
    eventId: string;
    eventParentIds: string[];
    eventCreatedAt: string;
    sessionId: string;
    data: FlowEventData;
    constructor(input: FlowEventInput);
}
export interface FlowLoggerContext {
    sessionId: string;
    eventBus: EventEmitterWithWildcardSupport;
    parentEvents: FlowEvent[];
}
type AsyncOriginalMethod<TArgs extends unknown[] = unknown[], TResult = unknown, TThis = unknown> = (this: TThis, ...args: TArgs) => Promise<TResult>;
type FlowLoggerLogOptions = FlowEventInput & {
    context?: FlowLoggerContext;
};
export declare class FlowLogger {
    private static cloneContext;
    private static resolveReentryContext;
    private static emit;
    private static runWithAutoStatusEventLogging;
    private static logCdpEvent;
    private static emitLlmEvent;
    private static buildMiddlewarePromptSummary;
    private static buildMiddlewareOutputSummary;
    static init(sessionId: string, eventBus: EventEmitterWithWildcardSupport): FlowLoggerContext;
    static close(context?: FlowLoggerContext | null): Promise<void>;
    static get currentContext(): FlowLoggerContext;
    static resolveContext(fallbackContext?: FlowLoggerContext | null): FlowLoggerContext | null;
    static wrapWithLogging<TMethod extends AsyncOriginalMethod>(options: FlowLoggerLogOptions): <TWrappedMethod extends AsyncOriginalMethod<Parameters<TMethod>, Awaited<ReturnType<TMethod>>, ThisParameterType<TMethod>>>(originalMethod: TWrappedMethod) => TWrappedMethod;
    static runWithLogging<TMethod extends AsyncOriginalMethod>(options: FlowLoggerLogOptions, originalMethod: TMethod, params: Readonly<Parameters<TMethod>>): Promise<Awaited<ReturnType<TMethod>>>;
    static runWithLogging<TResult>(options: FlowLoggerLogOptions, originalMethod: AsyncOriginalMethod<[], TResult>, params: ReadonlyArray<unknown>): Promise<Awaited<TResult>>;
    static withContext<T>(context: FlowLoggerContext, fn: () => T): T;
    private static readonly NOISY_CDP_EVENTS;
    static logCdpCallEvent(context: FlowLoggerContext, data: {
        method: string;
        params?: object;
        targetId?: string | null;
    }): FlowEvent | null;
    static logCdpResponseEvent(context: FlowLoggerContext, parentEvent: Pick<FlowEvent, "eventId" | "eventParentIds">, data: {
        method: string;
        result?: unknown;
        error?: string;
        targetId?: string | null;
    }): void;
    static logCdpMessageEvent(context: FlowLoggerContext, parentEvent: Pick<FlowEvent, "eventId" | "eventParentIds">, data: {
        method: string;
        params?: unknown;
        targetId?: string | null;
    }): void;
    static logLlmRequest({ requestId, model, prompt, }: {
        requestId: string;
        model: string;
        prompt?: string;
    }): void;
    static logLlmResponse({ requestId, model, output, inputTokens, outputTokens, }: {
        requestId: string;
        model: string;
        output?: string;
        inputTokens?: number;
        outputTokens?: number;
    }): void;
    static createLlmLoggingMiddleware(modelId: string): Pick<LanguageModelMiddleware, "wrapGenerate">;
}
export declare function extractLlmPromptSummary(messages: Array<{
    role: string;
    content: unknown;
}>, options?: {
    toolCount?: number;
    hasSchema?: boolean;
}): string | undefined;
export declare function extractLlmCuaPromptSummary(messages: unknown[]): string | undefined;
export declare function extractLlmCuaResponseSummary(output: unknown): string;
export {};
