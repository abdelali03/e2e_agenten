/**
 * Utility functions for XPath handling in agent tools.
 */
/**
 * Ensures a value is properly formatted as an XPath selector.
 * Returns null if the value is not a valid string.
 *
 * @param value - The value to normalize as an XPath
 * @returns The normalized XPath string prefixed with "xpath=" or null
 */
export declare function ensureXPath(value: unknown): string | null;
