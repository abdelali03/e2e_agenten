/**
 * NavigationResponseTracker
 * -------------------------
 *
 * Tracks DevTools Protocol network events for a single navigation command so
 * Stagehand can surface a Playwright-like response object from `Page.goto` and
 * related APIs. The tracker listens for `Network.responseReceived` events that
 * correspond to the targeted document navigation, handles loader-id churn that
 * arises from redirects or preloading, and enriches the resulting
 * `Response` with extra header information. It also observes
 * `Network.loadingFinished` / `Network.loadingFailed` to fulfil the
 * `response.finished()` contract exposed to consumers.
 */
import type { CDPSessionLike } from "./cdp.js";
import type { Page } from "./page.js";
import { Response } from "./response.js";
/**
 * Watches CDP events on a given session and resolves with the navigation's
 * primary document response once identified.
 */
export declare class NavigationResponseTracker {
    private readonly page;
    private readonly session;
    private readonly navigationCommandId;
    private expectedLoaderId;
    private selectedRequestId;
    private selectedResponse;
    private acceptNextWithoutLoader;
    private responseResolved;
    private resolveResponse;
    private responsePromise;
    private readonly pendingResponsesByLoader;
    private readonly pendingExtraInfo;
    private readonly listeners;
    /**
     * Create a tracker bound to a specific navigation command. The tracker begins
     * listening for network events immediately so it should be constructed before
     * the navigation request is dispatched.
     */
    constructor(params: {
        page: Page;
        session: CDPSessionLike;
        navigationCommandId: number;
    });
    /** Stop listening for CDP events and release any pending bookkeeping. */
    dispose(): void;
    /**
     * Hint the tracker with the loader id returned by `Page.navigate`. Chrome only
     * emits this once the browser begins navigating, so we store early responses
     * and match them once the loader id is known.
     */
    setExpectedLoaderId(loaderId: string | undefined): void;
    /**
     * Some navigation APIs (reload/history traversal) do not provide a loader id
     * up front. This flag instructs the tracker to accept the next qualifying
     * document response even if no loader id has been announced yet.
     */
    expectNavigationWithoutKnownLoader(): void;
    /**
     * Returns a promise that resolves with the matched response (or `null` when
     * no document response was observed).
     */
    navigationCompleted(): Promise<Response | null>;
    /** Expose the raw response promise (mainly for tests). */
    response(): Promise<Response | null>;
    /** Register all CDP listeners relevant to navigation tracking. */
    private installListeners;
    /** Attach a CDP listener and track it for later disposal. */
    private addListener;
    /** Handle the initial response payload for document navigations. */
    private onResponseReceived;
    /** Merge auxiliary header information once Chrome exposes it. */
    private onResponseReceivedExtraInfo;
    /** Resolve the response's finished promise when the request completes. */
    private onLoadingFinished;
    /** Resolve the response's finished promise with an error on failure. */
    private onLoadingFailed;
    /**
     * Create the `Response` wrapper for the chosen document response and
     * resolve awaiting consumers. Subsequent events flesh out the header/body
     * helpers and mark the request as finished.
     */
    private selectResponse;
}
