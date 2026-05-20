import { Protocol } from "devtools-protocol";
import type { CDPSessionLike } from "./cdp.js";
import { Locator } from "./locator.js";
interface FrameManager {
    session: CDPSessionLike;
    frameId: string;
    pageId: string;
}
/**
 * Frame
 *
 * A thin, session-bound handle to a specific DOM frame (by frameId).
 * All CDP calls in this class go through `this.session`, which MUST be the
 * owning session for `this.frameId`. Page is responsible for constructing
 * Frames with the correct session.
 */
export declare class Frame implements FrameManager {
    session: CDPSessionLike;
    frameId: string;
    pageId: string;
    private readonly remoteBrowser;
    /** Owning CDP session id (useful for logs); null for root connection (should not happen for targets) */
    readonly sessionId: string | null;
    constructor(session: CDPSessionLike, frameId: string, pageId: string, remoteBrowser: boolean);
    /** True when the controlled browser runs on a different machine. */
    isBrowserRemote(): boolean;
    /** DOM.getNodeForLocation → DOM.describeNode */
    getNodeAtLocation(x: number, y: number): Promise<Protocol.DOM.Node>;
    /** CSS selector → DOM.querySelector → DOM.getBoxModel */
    getLocationForSelector(selector: string): Promise<{
        x: number;
        y: number;
        width: number;
        height: number;
    }>;
    /** Accessibility.getFullAXTree (+ recurse into child frames if requested) */
    getAccessibilityTree(withFrames?: boolean): Promise<Protocol.Accessibility.AXNode[]>;
    /**
     * Evaluate a function or expression in this frame's main world.
     * - If a string is provided, treated as a JS expression.
     * - If a function is provided, it is stringified and invoked with the optional argument.
     */
    evaluate<R = unknown, Arg = unknown>(pageFunctionOrExpression: string | ((arg: Arg) => R | Promise<R>), arg?: Arg): Promise<R>;
    /** Page.captureScreenshot (frame-scoped session) */
    screenshot(options?: {
        fullPage?: boolean;
        clip?: {
            x: number;
            y: number;
            width: number;
            height: number;
        };
        type?: "png" | "jpeg";
        quality?: number;
        scale?: number;
    }): Promise<Buffer>;
    /** Child frames via Page.getFrameTree */
    childFrames(): Promise<Frame[]>;
    /** Wait for a lifecycle state (load/domcontentloaded/networkidle) */
    waitForLoadState(state?: "load" | "domcontentloaded" | "networkidle", timeoutMs?: number): Promise<void>;
    /** Simple placeholder for your own locator abstraction */
    locator(selector: string, options?: {
        deep?: boolean;
        depth?: number;
    }): Locator;
    /** Resolve the main-world execution context id for this frame. */
    private getMainWorldExecutionContextId;
}
export {};
