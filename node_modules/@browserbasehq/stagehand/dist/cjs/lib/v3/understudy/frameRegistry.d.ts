import type { Protocol } from "devtools-protocol";
/**
 * FrameRegistry
 *
 * Purpose:
 * A single, authoritative source of truth for **both**:
 *   1) Frame topology (parent/children, current main/root id, last-seen CDP `Frame`)
 *   2) Frame → Session ownership (which CDP session owns a given frameId)
 *   3) Optional iframe-owner metadata (backendNodeId of the <iframe> element in the parent doc)
 *
 *
 * Model:
 *  - This class is **CDP-agnostic**; it stores **sessionId strings** (not session objects).
 *  - Context bridges (wiring Target/Page events) must call the mutators below (onAttached,
 *    onNavigated, onDetached, adoptChildSession, seedFromFrameTree, setOwnerBackendNodeId).
 *  - Consumers ask read APIs (getOwnerSessionId, getParent, asProtocolFrameTree, listAll, …)
 *    and never probe ownership at run time.
 */
type FrameId = string;
type SessionId = string;
export declare class FrameRegistry {
    /** Owner target id (top-level target); informational only */
    private readonly ownerTargetId;
    /** Current main/root frame id (changes on root swaps) */
    private rootFrameId;
    /** frameId → FrameInfo */
    private frames;
    /** sessionId → Set<frameId> (inverse map for diagnostics/fast membership checks) */
    private framesBySession;
    constructor(ownerTargetId: string, mainFrameId: FrameId);
    /**
     * Record that a frame attached. If `parentId` is null and `frameId` differs from the current
     * root, this is a root swap and we rename the root id.
     *
     * IMPORTANT: The emitter's `sessionId` is the **owner** for the new/attached frame.
     */
    onFrameAttached(frameId: FrameId, parentId: FrameId | null, sessionId: SessionId): void;
    /**
     * Record a navigation with the full CDP `Frame`. Also updates ownership based on the emitting
     * session id. Handles root swap if the navigated frame is the new main (no parentId).
     */
    onFrameNavigated(frame: Protocol.Page.Frame, sessionId: SessionId): void;
    onNavigatedWithinDocument(frameId: FrameId, url: string, sessionId: SessionId): void;
    /**
     * Record that a frame detached. If `reason !== "swap"`, remove the subtree from the graph,
     * and clean the inverse maps. For “swap” we keep the node to preserve continuity.
     */
    onFrameDetached(frameId: FrameId, reason?: "remove" | "swap" | string): void;
    /**
     * An adopted OOPIF child session was created whose **main** frame id equals the parent iframe’s frameId.
     * We mark the entire child subtree as owned by `childSessionId`.
     * (Topology edges remain aligned by the parent session’s `frameAttached` events.)
     */
    adoptChildSession(childSessionId: SessionId, childMainFrameId: FrameId): void;
    /**
     * Seed topology and ownership from an existing `Page.getFrameTree` snapshot, typically right after
     * a session is attached. This is a best-effort: we record frames and set the provided `sessionId`
     * as owner for the subtree **if** an owner isn't already set.
     */
    seedFromFrameTree(sessionId: SessionId, frameTree: Protocol.Page.FrameTree): void;
    /**
     * Set the backendNodeId of the `<iframe>` element for a child frame **as seen from its parent**.
     * This is useful for building absolute XPath prefixes later (from the parent document).
     */
    setOwnerBackendNodeId(childFrameId: FrameId, backendNodeId: number): void;
    mainFrameId(): FrameId;
    /**
     * Return the owner session id for this frame. If unknown, returns `undefined`.
     */
    getOwnerSessionId(frameId: FrameId): SessionId | undefined;
    /**
     * Return the owner backendNodeId (iframe element) if recorded.
     * This is in the **parent** document; pair it with `getParent`.
     */
    getOwnerBackendNodeId(frameId: FrameId): number | undefined;
    /**
     * Return the parent frame id, or null for root/unknown.
     */
    getParent(frameId: FrameId): FrameId | null;
    /**
     * List frame ids in root-first DFS order (same shape as CDP’s FrameTree traversal).
     */
    listAllFrames(): FrameId[];
    /**
     * Serialize to `Protocol.Page.FrameTree` starting at the given root id (typically mainFrameId()).
     */
    asProtocolFrameTree(rootId: FrameId): Protocol.Page.FrameTree;
    /**
     * For diagnostics: return the current owner sessions for a frame id (0..n),
     * usually 0 or 1, but helpful to see potential inconsistencies during wiring.
     */
    sessionsForFrame(frameId: FrameId): SessionId[];
    /**
     * For diagnostics: return current frame set per session.
     */
    framesForSession(sessionId: SessionId): FrameId[];
    private ensureNode;
    private renameNodeId;
    private setOwnerSessionIdInternal;
}
export {};
