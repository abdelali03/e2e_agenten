import type { A11yNode } from "../../../types/private/snapshot.js";
/**
 * Render a formatted outline (with encoded ids) for the accessibility tree.
 * Keeps indentation logic shared between modules so unit tests can cover these
 * pure formatting helpers without a full snapshot pipeline.
 */
export declare function formatTreeLine(node: A11yNode, level?: number): string;
/**
 * Inject each child frame outline under the parent's iframe node line.
 * Keys in `idToTree` are the parent's iframe encoded ids.
 */
export declare function injectSubtrees(rootOutline: string, idToTree: Map<string, string>): string;
export declare function indentBlock(block: string, indent: string): string;
/**
 * Return the lines that appear in `nextTree` but not in `prevTree`.
 * Comparison is done line-by-line, ignoring leading whitespace in both trees.
 * The returned block is re-indented so the minimal indent becomes column 0.
 */
export declare function diffCombinedTrees(prevTree: string, nextTree: string): string;
/**
 * Remove whitespace noise and invisible code points before rendering names.
 */
export declare function cleanText(input: string): string;
/**
 * Collapse all whitespace runs in a string to a single space without trimming.
 * Exported for pruning routines that need the same normalization.
 */
export declare function normaliseSpaces(s: string): string;
