import type { Protocol } from "devtools-protocol";
import type { CDPSessionLike } from "../../cdp.js";
import type { A11yNode, A11yOptions, AccessibilityTreeResult } from "../../../types/private/snapshot.js";
/**
 * Fetch and prune the accessibility tree for a frame, optionally scoping the
 * output to a selector root for faster targeted snapshots.
 */
export declare function a11yForFrame(session: CDPSessionLike, frameId: string | undefined, opts: A11yOptions): Promise<AccessibilityTreeResult>;
export declare function decorateRoles(nodes: Protocol.Accessibility.AXNode[], opts: A11yOptions): A11yNode[];
export declare function buildHierarchicalTree(nodes: A11yNode[], opts: A11yOptions): Promise<{
    tree: A11yNode[];
}>;
export declare function isStructural(role: string): boolean;
export declare function extractUrlFromAXNode(ax: Protocol.Accessibility.AXNode): string | undefined;
export declare function removeRedundantStaticTextChildren(parent: A11yNode, children: A11yNode[]): A11yNode[];
