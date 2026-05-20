/**
 * Shared cleanup logic for locally launched Chrome.
 *
 * Used by both `V3.close()` (normal shutdown) and the supervisor process
 * (crash cleanup). The caller provides a `killChrome` callback since the
 * kill mechanism differs: chrome-launcher's `chrome.kill()` in-process
 * vs raw `process.kill(pid)` from the supervisor.
 */
export declare function cleanupLocalBrowser(opts: {
    killChrome?: () => Promise<void> | void;
    userDataDir?: string;
    createdTempProfile?: boolean;
    preserveUserDataDir?: boolean;
}): Promise<void>;
