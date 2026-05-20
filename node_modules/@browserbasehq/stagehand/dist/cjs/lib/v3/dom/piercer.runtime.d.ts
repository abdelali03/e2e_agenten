export interface V3ShadowPatchOptions {
    debug?: boolean;
    tagExisting?: boolean;
}
export interface StagehandV3Backdoor {
    /** Closed shadow-root accessors */
    getClosedRoot(host: Element): ShadowRoot | undefined;
    /** Stats + quick health check */
    stats(): {
        installed: true;
        url: string;
        isTop: boolean;
        open: number;
        closed: number;
    };
}
declare global {
    interface Window {
        __stagehandV3Injected?: boolean;
        __stagehandV3__?: StagehandV3Backdoor;
    }
}
export declare function installV3ShadowPiercer(opts?: V3ShadowPatchOptions): void;
