import { FlowEvent } from "./FlowLogger.js";
import type { EventStoreApi, EventStoreQuery } from "./EventStore.js";
export interface EventSink {
    emit(event: FlowEvent): Promise<void>;
    query(query: EventStoreQuery): Promise<FlowEvent[]>;
    destroy(): Promise<void>;
}
declare abstract class FileEventSink implements EventSink {
    private readonly streamPromise;
    constructor(sessionDirPromise: Promise<string | null>, fileName: string);
    protected abstract serialize(event: FlowEvent): Promise<string | null>;
    emit(event: FlowEvent): Promise<void>;
    query(): Promise<FlowEvent[]>;
    destroy(): Promise<void>;
}
export declare class JsonlFileEventSink extends FileEventSink {
    constructor(sessionDirPromise: Promise<string | null>);
    protected serialize(event: FlowEvent): Promise<string>;
}
export declare class PrettyLogFileEventSink extends FileEventSink {
    private readonly store;
    constructor(sessionDirPromise: Promise<string | null>, store: Pick<EventStoreApi, "query">);
    protected serialize(event: FlowEvent): Promise<string | null>;
}
export declare class PrettyStderrEventSink implements EventSink {
    private readonly store;
    constructor(store: Pick<EventStoreApi, "query">);
    emit(event: FlowEvent): Promise<void>;
    query(): Promise<FlowEvent[]>;
    destroy(): Promise<void>;
}
export declare class InMemoryEventSink implements EventSink {
    protected readonly limit: number;
    constructor(limit?: number);
    protected readonly events: FlowEvent[];
    protected storeEvent(event: FlowEvent): FlowEvent;
    emit(event: FlowEvent): Promise<void>;
    query(query: EventStoreQuery): Promise<FlowEvent[]>;
    destroy(): Promise<void>;
}
export declare class ShallowInMemoryEventSink extends InMemoryEventSink {
    protected storeEvent(event: FlowEvent): FlowEvent;
}
export {};
