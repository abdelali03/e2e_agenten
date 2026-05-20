import { Frame } from "../../understudy/frame.js";
import { Locator } from "../../understudy/locator.js";
import type { Page } from "../../understudy/page.js";
export interface UnderstudyMethodHandlerContext {
    method: string;
    locator: Locator;
    xpath: string;
    args: ReadonlyArray<string>;
    frame: Frame;
    page: Page;
    initialUrl: string;
    domSettleTimeoutMs?: number;
}
export declare function performUnderstudyMethod(page: Page, frame: Frame, method: string, rawXPath: string, args: ReadonlyArray<unknown>, domSettleTimeoutMs?: number): Promise<void>;
export declare function selectOption(ctx: UnderstudyMethodHandlerContext): Promise<void>;
export declare function hover(ctx: UnderstudyMethodHandlerContext): Promise<void>;
/**
 * More robust DOM settle using Network + Page events to detect network quiet.
 * Closely modeled after the provided snippet, adapted to our Frame/session + logger.
 */
export declare function waitForDomNetworkQuiet(frame: Frame, timeoutMs?: number): Promise<void>;
