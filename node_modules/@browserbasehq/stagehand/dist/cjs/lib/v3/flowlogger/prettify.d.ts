import { FlowEvent } from "./FlowLogger.js";
import type { EventStoreApi } from "./EventStore.js";
export declare function prettifySanitizeEvent(event: FlowEvent): FlowEvent;
export declare function prettifyIsCdpEvent(event: FlowEvent): boolean;
export declare function prettifyEvent(store: Pick<EventStoreApi, "query">, event: FlowEvent): Promise<string | null>;
export declare function prettifyColorStderrLine(line: string): string;
