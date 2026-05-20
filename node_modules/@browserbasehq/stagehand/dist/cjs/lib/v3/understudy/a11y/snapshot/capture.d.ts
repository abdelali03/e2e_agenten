import { Page } from "../../page.js";
import type { FrameContext, FrameDomMaps, HybridSnapshot, SnapshotOptions, SessionDomIndex } from "../../../types/private/index.js";
type IgnoredNodeMap = Map<string, Set<number>>;
type Interval = {
    start: number;
    end: number;
};
type ExclusionIntervalsByFrame = Map<string, Interval[]>;
/**
 * Capture a hybrid DOM + Accessibility snapshot for the provided page.
 *
 * Flow overview:
 * 1. (Optional) Scope directly to a requested selector. We walk iframe hops to
 *    find the owning frame, build just that frame’s DOM + AX tree, and bail out
 *    early when the subtree satisfies the caller.
 * 2. Build DOM indexes for every unique CDP session. DOM.getDocument is called
 *    once per session and hydrated so per-frame slices can share the result.
 * 3. Slice each frame’s DOM data from its session index and fetch its AX tree.
 *    This yields relative XPath/tag/url maps for the document rooted at that frame.
 * 4. Walk the frame tree to compute absolute iframe prefixes. Every child frame
 *    needs the XPath of the iframe element that hosts it so we can prefix maps.
 * 5. Merge all per-frame results into global combined maps and stitch the text
 *    outline. The final payload mirrors the legacy shape but is built in layers.
 *
 * Each numbered block below references the step above for easier debugging.
 */
export declare function captureHybridSnapshot(page: Page, options?: SnapshotOptions): Promise<HybridSnapshot>;
/**
 * Snapshot the current frame tree so downstream helpers have consistent topology
 * without re-querying CDP. The map is intentionally shallow (frameId → parentId)
 * so it is serializable/testable without holding on to CDP handles.
 */
export declare function buildFrameContext(page: Page): FrameContext;
/**
 * Step 1 – scoped snapshot fast-path. If a selector is provided we try to:
 *  1) Resolve the selector (XPath or CSS) across iframes.
 *  2) Build DOM + AX data only for the owning frame.
 *  3) Bail out early when the selector's subtree satisfies the request.
 *
 * Returns `null` when scoping fails (e.g., selector miss) so the caller can
 * fall back to the full multi-frame snapshot.
 */
export declare function tryScopedSnapshot(page: Page, options: SnapshotOptions | undefined, context: FrameContext, pierce: boolean, sessionToIndex: Map<string, SessionDomIndex>, exclusionIntervalsByFrame: ExclusionIntervalsByFrame): Promise<HybridSnapshot | null>;
/**
 * Step 2 – call DOM.getDocument once per unique CDP session and hydrate the
 * result so per-frame slices can share the structure. We key by session id
 * because same process iframes live inside the same session.
 */
export declare function buildSessionIndexes(page: Page, frames: string[], pierce: boolean): Promise<Map<string, SessionDomIndex>>;
/**
 * Step 3 – derive per-frame DOM maps and accessibility outlines.
 * Each frame:
 *  - slices the shared session index down to its document root
 *  - builds frame-aware encoded ids (ordinal-backendNodeId)
 *  - collects tag/xpath/scrollability maps for DOM-based lookups
 *  - fetches its AX tree to produce outlines and URL maps
 */
export declare function collectPerFrameMaps(page: Page, context: FrameContext, sessionToIndex: Map<string, SessionDomIndex>, options: SnapshotOptions | undefined, pierce: boolean, frameIds: string[], exclusionIntervalsByFrame: ExclusionIntervalsByFrame): Promise<{
    perFrameMaps: Map<string, FrameDomMaps>;
    perFrameOutlines: Array<{
        frameId: string;
        outline: string;
    }>;
}>;
export declare function resolveIgnoredNodes(page: Page, ignoreSelectors: string[] | undefined, context: FrameContext, sessionToIndex: Map<string, SessionDomIndex>): Promise<IgnoredNodeMap>;
export declare function buildFrameExclusionIntervals(page: Page, context: FrameContext, sessionToIndex: Map<string, SessionDomIndex>, ignoredNodesByFrame: IgnoredNodeMap): Promise<ExclusionIntervalsByFrame>;
/**
 * Step 4 – walk the frame tree (parent-first) to compute absolute prefixes for
 * every frame. The prefix is the absolute XPath of the iframe element hosting
 * the frame, so we can later convert relative XPaths into cross-frame ones.
 */
export declare function computeFramePrefixes(page: Page, context: FrameContext, perFrameMaps: Map<string, FrameDomMaps>, frameIds: string[]): Promise<{
    absPrefix: Map<string, string>;
    iframeHostEncByChild: Map<string, string>;
}>;
/**
 * Step 5 – merge per-frame maps into the combined snapshot payload. We prefix
 * each frame's relative XPaths with the absolute path collected in step 4,
 * merge URL maps, and stitch text outlines by nesting child trees under the
 * encoded id of their parent iframe host.
 */
export declare function mergeFramesIntoSnapshot(context: FrameContext, perFrameMaps: Map<string, FrameDomMaps>, perFrameOutlines: Array<{
    frameId: string;
    outline: string;
}>, absPrefix: Map<string, string>, iframeHostEncByChild: Map<string, string>, frameIds: string[]): HybridSnapshot;
export {};
