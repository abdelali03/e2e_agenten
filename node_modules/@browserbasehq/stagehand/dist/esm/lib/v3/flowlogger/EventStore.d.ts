import type { V3Options } from "../types/public/index.js";
import { EventSink } from "./EventSink.js";
import { FlowEvent } from "./FlowLogger.js";
export interface EventStoreQuery {
    sessionId?: string;
    eventId?: string;
    eventType?: string;
    limit?: number;
}
export interface EventStoreApi {
    readonly sessionId: string;
    emit(event: FlowEvent): Promise<void>;
    query(query: EventStoreQuery): Promise<FlowEvent[]>;
    destroy(): Promise<void>;
}
export declare function getConfigDir(): string;
export declare class EventStore implements EventStoreApi {
    readonly sessionId: string;
    private readonly sinks;
    private destroyed;
    query: (query: EventStoreQuery) => Promise<FlowEvent[]>;
    constructor(sessionId: string, options?: V3Options, querySink?: EventSink);
    private registerSink;
    emit: (event: FlowEvent) => Promise<void>;
    destroy(): Promise<void>;
}
