/**
 * waitForSelector - Waits for an element matching a selector to reach a specific state.
 * Supports both CSS selectors and XPath expressions.
 * Uses MutationObserver for efficiency and integrates with the V3 piercer for closed shadow roots.
 *
 * NOTE: This function runs inside the page context. Keep it dependency-free
 * and resilient to exceptions.
 */
/**
 * Wait for an element matching the selector to reach the specified state.
 * Supports both CSS selectors and XPath expressions (prefix with "xpath=" or start with "/").
 *
 * @param selectorRaw - CSS selector or XPath expression to wait for
 * @param stateRaw - Element state: 'attached' | 'detached' | 'visible' | 'hidden'
 * @param timeoutRaw - Maximum time to wait in milliseconds
 * @param pierceShadowRaw - Whether to search inside shadow DOM
 * @returns Promise that resolves to true when condition is met, or rejects on timeout
 */
export declare function waitForSelector(selectorRaw: string, stateRaw?: string, timeoutRaw?: number, pierceShadowRaw?: boolean): Promise<boolean>;
