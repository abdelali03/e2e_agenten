import type { Protocol } from "devtools-protocol";
import type { CDPSessionLike } from "../../cdp.js";
import type { SessionDomIndex } from "../../../types/private/snapshot.js";
/**
 * Determine if CDP truncated a node's children when streaming the DOM tree.
 * childNodeCount stays accurate even when `children` are omitted; we use this to
 * decide whether DOM.describeNode must be re-run for that node.
 */
export declare function shouldExpandNode(node: Protocol.DOM.Node): boolean;
/** Merge an expanded DescribeNode payload back into the original shallow node. */
export declare function mergeDomNodes(target: Protocol.DOM.Node, source: Protocol.DOM.Node): void;
/** Helper that returns every nested collection we recurse through uniformly. */
export declare function collectDomTraversalTargets(node: Protocol.DOM.Node): Protocol.DOM.Node[];
/**
 * Rehydrate a truncated DOM tree by repeatedly calling DOM.describeNode with
 * decreasing depths. Any non-CBOR failure is surfaced as a StagehandDomProcessError.
 */
export declare function hydrateDomTree(session: CDPSessionLike, root: Protocol.DOM.Node, pierce: boolean): Promise<void>;
/**
 * Attempt DOM.getDocument with progressively shallower depths until CBOR stops
 * complaining. When a shallower snapshot is returned we hydrate the missing
 * branches so downstream DOM traversals see the full tree shape.
 */
export declare function getDomTreeWithFallback(session: CDPSessionLike, pierce: boolean): Promise<Protocol.DOM.Node>;
/**
 * Build tag name and XPath maps for a single frame session.
 * EncodedId is produced by a frame-aware encoder provided by the caller.
 */
export declare function domMapsForSession(session: CDPSessionLike, frameId: string, pierce: boolean, encode: (fid: string, backendNodeId: number) => string, attemptOwnerLookup?: boolean): Promise<{
    tagNameMap: Record<string, string>;
    xpathMap: Record<string, string>;
    scrollableMap: Record<string, boolean>;
}>;
/**
 * Build an index of absolute XPath/tag metadata for an entire CDP session.
 * Once the index is cached, per-frame slices are derived without extra DOM
 * calls, which keeps snapshot capture linear in the number of frames.
 */
export declare function buildSessionDomIndex(session: CDPSessionLike, pierce: boolean): Promise<SessionDomIndex>;
/**
 * Relativize an absolute XPath against a document root's absolute path.
 * When the node lives outside the document we return the absolute path as-is.
 */
export declare function relativizeXPath(baseAbs: string, nodeAbs: string): string;
/** Find a node by backendNodeId inside a DOM.getDocument tree. */
export declare function findNodeByBackendId(root: Protocol.DOM.Node, backendNodeId: number): Protocol.DOM.Node | undefined;
