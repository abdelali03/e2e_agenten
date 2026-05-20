import { Page } from "../../page.js";
import type { ResolvedLocation } from "../../../types/private/snapshot.js";
/**
 * Resolve deepest node for a page coordinate and compute its absolute XPath across frames.
 * More efficient than building a full hybrid snapshot when only a single node’s XPath is needed.
 */
export declare function resolveXpathForLocation(page: Page, x: number, y: number): Promise<ResolvedLocation | null>;
