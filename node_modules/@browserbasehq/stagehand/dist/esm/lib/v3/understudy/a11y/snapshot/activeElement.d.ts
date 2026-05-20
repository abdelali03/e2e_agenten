import { Page } from "../../page.js";
/**
 * Compute the absolute XPath for the currently focused element.
 * - Detects which frame has focus via document.hasFocus().
 * - Finds the deepest activeElement (dives into shadow DOM).
 * - Builds an absolute, cross-frame XPath by prefixing iframe hosts.
 */
export declare function computeActiveElementXpath(page: Page): Promise<string | null>;
