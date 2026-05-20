import type { CDPSessionLike } from "../../cdp.js";
import { Page } from "../../page.js";
import type { FrameParentIndex, ResolvedCssFocus, ResolvedFocusFrame, Step } from "../../../types/private/snapshot.js";
/**
 * Parse a cross-frame XPath into discrete steps. Each step tracks whether it
 * represents a descendant hop (“//”) or a single-child hop (“/”).
 */
export declare function parseXPathToSteps(path: string): Step[];
/** Rebuild an XPath string from parsed steps. */
export declare function buildXPathFromSteps(steps: ReadonlyArray<Step>): string;
export declare const IFRAME_STEP_RE: RegExp;
/**
 * Given a cross-frame XPath, walk iframe steps to resolve:
 * - the target frameId (last iframe hop)
 * - the tail XPath (within the target frame)
 * - the absolute XPath prefix up to the iframe element hosting that frame
 */
export declare function resolveFocusFrameAndTail(page: Page, absoluteXPath: string, parentByFrame: FrameParentIndex, rootId: string): Promise<ResolvedFocusFrame>;
/** Resolve focus frame and tail CSS selector using '>>' to hop iframes. */
export declare function resolveCssFocusFrameAndTail(page: Page, rawSelector: string, parentByFrame: FrameParentIndex, rootId: string): Promise<ResolvedCssFocus>;
/** Resolve an XPath to a Runtime remoteObjectId in the given CDP session. */
export declare function resolveObjectIdForXPath(session: CDPSessionLike, xpath: string, frameId?: string): Promise<string | null>;
/** Resolve a CSS selector (supports '>>' within the same frame only) to a Runtime objectId. */
export declare function resolveObjectIdForCss(session: CDPSessionLike, selector: string, frameId?: string): Promise<string | null>;
export declare function listChildrenOf(parentByFrame: FrameParentIndex, parentId: string): string[];
