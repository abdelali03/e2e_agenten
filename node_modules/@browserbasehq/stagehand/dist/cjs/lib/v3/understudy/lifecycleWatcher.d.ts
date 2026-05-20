import type { LoadState } from "../types/public/page.js";
import type { CDPSessionLike } from "./cdp.js";
import type { NetworkManager } from "./networkManager.js";
import type { Page } from "./page.js";
/**
 * Coordinates page lifecycle waits (load/domcontentloaded/networkidle) while
 * following main-frame swaps and navigation aborts. Each navigation spawns a
 * one-off watcher that listens for relevant CDP events and resolves or rejects
 * depending on the requested `waitUntil` state.
 */
/**
 * Small utility that mirrors Playwright's lifecycle watcher semantics. Bridges
 * main-frame lifecycle events with the NetworkManager's idle signal so callers
 * can await `load`, `domcontentloaded`, or `networkidle` with a single promise.
 */
export declare class LifecycleWatcher {
    private readonly page;
    private readonly mainSession;
    private readonly networkManager;
    private readonly waitUntil;
    private readonly timeoutMs;
    private readonly startTime;
    private readonly navigationCommandId;
    private currentLoaderId;
    private idleStartTime;
    private cleanupCallbacks;
    private idleHandle;
    private abortReject;
    private abortPromise;
    private abortError;
    private disposed;
    private expectedLoaderId;
    private initialLoaderId;
    private pendingFollowupNavigation;
    /**
     * Create a watcher; callers should subsequently invoke {@link wait}.
     */
    constructor(params: {
        page: Page;
        mainSession: CDPSessionLike;
        networkManager: NetworkManager;
        waitUntil: LoadState;
        timeoutMs: number;
        navigationCommandId: number;
    });
    /** Hint the watcher with the loader id returned by Page.navigate. */
    setExpectedLoaderId(loaderId: string | undefined): void;
    /** Wait for the requested lifecycle state or throw on timeout/abort. */
    wait(): Promise<void>;
    /** Cancel any outstanding network-idle waits and remove event listeners. */
    dispose(): void;
    /** Subscribe to main-frame events to detect abort conditions. */
    private installSessionListeners;
    /** Compute remaining time until the shared deadline elapses. */
    private timeRemaining;
    /** Await an operation but abort early if navigation replacement fires. */
    private awaitWithAbort;
    /** Mark the watcher as aborted and reject any pending waiters. */
    private triggerAbort;
    private waitForNetworkIdle;
    private shouldRestartAfterFollowup;
    private adoptNewMainLoader;
    private buildIdleFilter;
}
