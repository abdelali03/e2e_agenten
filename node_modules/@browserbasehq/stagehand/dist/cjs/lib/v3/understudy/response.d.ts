/**
 * Response
 * -----------------
 *
 * This module implements a Playwright-inspired response wrapper that exposes
 * navigation metadata and helpers for retrieving HTTP response bodies. The
 * abstraction is consumed by navigation routines (e.g. `Page.goto`) so callers
 * can synchronously inspect status codes, lazily fetch body text, or await the
 * network layer finishing the request. The implementation is built directly on
 * Chrome DevTools Protocol primitives – it holds the originating `requestId`
 * so it can request payloads via `Network.getResponseBody`, and it listens for
 * `responseReceivedExtraInfo`, `loadingFinished`, and `loadingFailed` events to
 * hydrate the richer header view and resolve callers waiting on completion.
 */
import type { Protocol } from "devtools-protocol";
import type { SerializableResponse } from "../types/private/index.js";
import type { CDPSessionLike } from "./cdp.js";
import type { Frame } from "./frame.js";
import type { Page } from "./page.js";
type ServerAddr = {
    ipAddress: string;
    port: number;
};
export declare function isSerializableResponse(value: unknown): value is SerializableResponse;
/**
 * Thin wrapper around CDP response metadata that mirrors the ergonomics of
 * Playwright's `Response` class. The class intentionally keeps the same method
 * names so upstream integrations can transition with minimal code changes.
 */
export declare class Response {
    private readonly page;
    private readonly session;
    private readonly requestId;
    private readonly frameId?;
    private readonly loaderId?;
    private readonly response;
    private readonly fromServiceWorkerFlag;
    private readonly serverAddress?;
    private headersObject;
    private headersArrayCache;
    private allHeadersCache;
    private readonly headerValuesMap;
    private finishedDeferred;
    private finishedSettled;
    private extraInfoHeaders;
    private extraInfoHeadersText;
    /**
     * Build a response wrapper from the CDP notification associated with a
     * navigation. The constructor captures the owning page/session so follow-up
     * methods (body/text/json) can query CDP on-demand. The `response` payload is
     * the raw `Protocol.Network.Response` object emitted by Chrome.
     */
    constructor(params: {
        page: Page;
        session: CDPSessionLike;
        requestId: string;
        frameId?: string;
        loaderId?: string;
        response: Protocol.Network.Response;
        fromServiceWorker: boolean;
    });
    /** URL associated with the navigation request. */
    url(): string;
    /** HTTP status code reported by Chrome. */
    status(): number;
    /** Human-readable status text that accompanied the response. */
    statusText(): string;
    /** Convenience predicate that checks for 2xx statuses. */
    ok(): boolean;
    /** Returns the Stagehand frame object that initiated the navigation. */
    frame(): Frame | null;
    /** Indicates whether the response was serviced by a Service Worker. */
    fromServiceWorker(): boolean;
    /**
     * Returns TLS security metadata when provided by the browser. In practice
     * this includes certificate issuer, protocol, and validity interval.
     */
    securityDetails(): Promise<Protocol.Network.SecurityDetails | null>;
    /** Returns the resolved server address for the navigation when available. */
    serverAddr(): Promise<ServerAddr | null>;
    /**
     * Returns the response headers normalised to lowercase keys. Matches the
     * behaviour of Playwright's `headers()` by eliding duplicate header entries.
     */
    headers(): Record<string, string>;
    /**
     * Returns all headers including those only surfaced through
     * `responseReceivedExtraInfo` such as `set-cookie`. Values are reported as the
     * browser sends them (no further splitting or concatenation).
     */
    allHeaders(): Promise<Record<string, string>>;
    /** Returns a concatenated header string for the supplied header name. */
    headerValue(name: string): Promise<string | null>;
    /** Returns all values for a header (case-insensitive lookup). */
    headerValues(name: string): Promise<string[]>;
    /**
     * Returns header entries preserving their original wire casing and ordering.
     * Falls back to the CDP object when the raw header text is unavailable.
     */
    headersArray(): Promise<Array<{
        name: string;
        value: string;
    }>>;
    /**
     * Requests the raw response body from Chrome DevTools Protocol. The method is
     * intentionally lazy because not every caller needs the payload, and CDP only
     * allows retrieving it once the response completes.
     */
    body(): Promise<Buffer>;
    /** Decodes the response body as UTF-8 text. */
    text(): Promise<string>;
    /** Parses the response body as JSON and throws if parsing fails. */
    json<T = unknown>(): Promise<T>;
    /**
     * Resolves once the underlying network request completes or fails. Mirrors
     * Playwright's behaviour by resolving to `null` on success and to an `Error`
     * instance when Chrome reports `Network.loadingFailed`.
     */
    finished(): Promise<null | Error>;
    /**
     * Internal helper invoked by the navigation tracker when CDP reports extra
     * header information. This keeps the cached header views in sync with the
     * richer metadata.
     */
    applyExtraInfo(event: Protocol.Network.ResponseReceivedExtraInfoEvent): void;
    /**
     * Internal helper for creating a Response object from a Serializable
     * goto response from the Stagehand API
     */
    static fromSerializable(serialized: SerializableResponse, context: {
        page: Page;
        session: CDPSessionLike;
    }): Response;
    /** Marks the response as finished and resolves the `finished()` promise. */
    markFinished(error: Error | null): void;
}
export {};
