import type { CDPSessionLike } from "./cdp.js";
import { NetworkObserver, WaitForIdleHandle, WaitForIdleOptions } from "../types/private/network.js";
/**
 * Cross-session network tracker.
 *
 * Centralises network bookkeeping for a Page: every CDP session (top-level and OOPIF)
 * funnels `Network.*` events through here so higher-level waiters can reason about
 * in-flight requests across the entire frame tree. The manager exposes a simple
 * observer interface plus a "wait until idle" helper that resolves once no filtered
 * requests remain for a quiet window.
 */
/**
 * Aggregates network information for all CDP sessions owned by a Page.
 */
export declare class NetworkManager {
    private readonly sessions;
    private readonly observers;
    private readonly requests;
    private readonly documentRequestsByFrame;
    /**
     * Begin tracking network traffic for a CDP session (top-level or OOPIF).
     * Safe to call multiple times; duplicate registrations are ignored.
     */
    trackSession(session: CDPSessionLike): void;
    /**
     * Stop tracking a session and discard any inflight bookkeeping owned by it.
     */
    untrackSession(rawSessionId: string | undefined): void;
    /**
     * Register a passive observer for request lifecycle notifications.
     * Returns a disposer that removes the observer.
     */
    addObserver(observer: NetworkObserver): () => void;
    /**
     * Resolve once no (filtered) requests are in flight for the given quiet window.
     * The waiter automatically unregisters itself on completion or timeout.
     */
    waitForIdle(options: WaitForIdleOptions): WaitForIdleHandle;
    /**
     * Tear down all session listeners and clear observers/bookkeeping.
     */
    dispose(): void;
    /** Fan-out helper when a tracked request starts. */
    private emitStart;
    /** Fan-out helper when a tracked request completes successfully. */
    private emitFinish;
    /** Fan-out helper when a tracked request fails mid-flight. */
    private emitFailure;
    /** Compute a stable key for a session (falls back to synthetic root id). */
    private sessionKey;
    /** Compose the unique key for tracking a request under a session. */
    private requestKey;
}
