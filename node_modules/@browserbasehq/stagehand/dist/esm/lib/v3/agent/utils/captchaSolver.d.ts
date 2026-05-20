import type { Page } from "../../understudy/page.js";
/** Injected into the agent message stream after a successful captcha solve. */
export declare const CAPTCHA_SOLVED_MSG = "A captcha was automatically detected and solved \u2014 no further interaction with the captcha is needed, even if it does not visually appear solved. Do not click the captcha checkbox, widget, or challenge again. Continue with your task.";
/** Injected into the agent message stream when the captcha solver fails. */
export declare const CAPTCHA_ERRORED_MSG = "A captcha was detected but the automatic captcha solver failed to solve it. You may need to try a different approach or navigate around the captcha.";
/** Appended to the system prompt (DOM/hybrid agents) when captchas auto-solve. */
export declare const CAPTCHA_SYSTEM_PROMPT_NOTE = "Captchas on this page are automatically detected and solved by the browser environment. Do not interact with or attempt to solve any captchas yourself \u2014 they will be handled for you. Do not click the captcha checkbox, widget, or challenge again after it has been solved, even if it still looks unresolved. Continue with your task as if the captcha does not exist.";
/** Appended to the CUA system prompt when captchas auto-solve. */
export declare const CAPTCHA_CUA_SYSTEM_PROMPT_NOTE = "\n\nCaptchas on this page are automatically detected and solved by the browser environment. Do not interact with or attempt to solve any captchas yourself \u2014 they will be handled for you. Continue with your task as if the captcha does not exist.";
/**
 * Tracks Browserbase captcha solver state via console messages and provides
 * a blocking `waitIfSolving()` that agents call before each step/action.
 *
 * Accepts a page-provider callback so the listener is automatically
 * re-attached when the active page changes (e.g. popup / new tab).
 *
 * All concurrent callers of `waitIfSolving()` share the same underlying
 * promise, so multiple waiters are safely resolved together.
 */
export declare class CaptchaSolver {
    private solving;
    private _solvedSinceLastConsume;
    private _erroredSinceLastConsume;
    private listener;
    private attachedPage;
    private pageProvider;
    /** Shared promise that all concurrent waitIfSolving() callers await. */
    private waitPromise;
    /** Resolves the shared waitPromise. */
    private resolveWait;
    /** Timeout handle for the 90s deadline. */
    private waitTimer;
    /**
     * Initialise with a callback that returns the current active page.
     * The listener is lazily (re-)attached whenever the active page changes.
     */
    init(pageProvider: () => Promise<Page>): void;
    /** Whether a captcha solve is currently in progress. */
    isSolving(): boolean;
    /**
     * Ensure the console listener is attached to the current active page.
     * If the active page has changed since the last call, the old listener
     * is removed and a new one is installed.
     */
    ensureAttached(): Promise<void>;
    /**
     * Returns a promise that resolves immediately if no captcha is being
     * solved, or blocks until the solver finishes, errors, or the 90s
     * timeout is reached.
     *
     * Also re-attaches the listener to the current active page if it has
     * changed since the last call.
     *
     * All concurrent callers share the same promise, so no waiter is
     * orphaned.
     */
    waitIfSolving(): Promise<void>;
    /**
     * Returns and resets the solve event flags.
     * Call after `waitIfSolving()` to check whether a captcha was solved
     * (or errored) since the last consume.  This captures events even if
     * the solve completed between two `waitIfSolving()` calls.
     */
    consumeSolveResult(): {
        solved: boolean;
        errored: boolean;
    };
    /**
     * Remove the console listener and reset all state.
     */
    dispose(): void;
    /** Remove the console listener from the currently attached page. */
    private detachListener;
    /** Resolve the shared wait promise and clear the timeout. */
    private settle;
}
