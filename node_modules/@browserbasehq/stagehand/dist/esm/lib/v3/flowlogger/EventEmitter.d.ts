import { EventEmitter } from "node:events";
export declare class EventEmitterWithWildcardSupport extends EventEmitter {
    private readonly wildcardListeners;
    on(eventName: string | symbol, listener: (...args: unknown[]) => void): this;
    off(eventName: string | symbol, listener: (...args: unknown[]) => void): this;
    emit(eventName: string | symbol, ...args: unknown[]): boolean;
}
