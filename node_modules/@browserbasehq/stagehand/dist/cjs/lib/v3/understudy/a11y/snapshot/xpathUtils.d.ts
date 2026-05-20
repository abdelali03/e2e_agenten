import type { Protocol } from "devtools-protocol";
import type { CDPSessionLike } from "../../cdp.js";
/**
 * Build the absolute XPath for a node by walking through every iframe host
 * we've traversed so far followed by the leaf backend node.
 */
export declare function buildAbsoluteXPathFromChain(chain: Array<{
    parentSession: CDPSessionLike;
    iframeBackendNodeId: number;
}>, leafSession: CDPSessionLike, leafBackendNodeId: number): Promise<string | null>;
/**
 * Resolve a backend node to an absolute XPath within the provided session.
 * The CDP Runtime is used so we can invoke a small helper that walks the DOM.
 */
export declare function absoluteXPathForBackendNode(session: CDPSessionLike, backendNodeId: number): Promise<string | null>;
/**
 * Prefix `child` XPath with an absolute iframe path `parentAbs`.
 * Handles root slashes and shadow hops (“//”) cleanly.
 */
export declare function prefixXPath(parentAbs: string, child: string): string;
/** Normalize an XPath: strip `xpath=`, ensure leading '/', remove trailing '/'. */
export declare function normalizeXPath(x?: string): string;
/** Build per-sibling XPath steps for DOM traversal. */
export declare function buildChildXPathSegments(kids: Protocol.DOM.Node[]): string[];
/** Join two XPath fragments while preserving special shadow-root hops. */
export declare function joinXPath(base: string, step: string): string;
