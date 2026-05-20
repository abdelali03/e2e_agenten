import type { Page } from "../../understudy/page.js";
/**
 * Waits for the page to settle and captures a screenshot.
 * If the screenshot fails (e.g., page closed, navigation in progress),
 * returns undefined instead of throwing - allowing the action to still succeed.
 *
 * @param page - The page to capture
 * @param delayMs - Delay before capturing (default: 500ms, pass 0 to skip delay)
 */
export declare function waitAndCaptureScreenshot(page: Page, delayMs?: number): Promise<string | undefined>;
