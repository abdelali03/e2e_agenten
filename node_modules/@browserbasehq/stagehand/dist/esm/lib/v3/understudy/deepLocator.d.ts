import { Locator } from "./locator.js";
import type { Frame } from "./frame.js";
import type { Page } from "./page.js";
export type ResolvedLocatorTarget = {
    frame: Frame;
    selector: string;
};
/** Build a Locator scoped to the correct frame for a deep XPath crossing iframes. */
export declare function deepLocatorThroughIframes(page: Page, root: Frame, xpathOrSelector: string): Promise<Locator>;
/**
 * Unified resolver that supports '>>' hop notation, deep XPath across iframes,
 * and plain single-frame selectors. Keeps hop logic in one shared place.
 */
export declare function resolveLocatorTarget(page: Page, root: Frame, selectorRaw: string): Promise<ResolvedLocatorTarget>;
export declare function resolveLocatorWithHops(page: Page, root: Frame, selectorRaw: string): Promise<Locator>;
/**
 * DeepLocatorDelegate: a lightweight wrapper that looks like a Locator and
 * resolves to the correct frame/element on each call using hop/deep-XPath logic.
 *
 * Returned by `page.deepLocator()` for ergonomic, await-free chaining:
 *   page.deepLocator('iframe#ifrA >> #btn').click()
 */
export declare class DeepLocatorDelegate {
    private readonly page;
    private readonly root;
    private readonly selector;
    private readonly nthIndex;
    constructor(page: Page, root: Frame, selector: string, nthIndex?: number);
    private real;
    click(options?: {
        button?: "left" | "right" | "middle";
        clickCount?: number;
    }): Promise<void>;
    count(): Promise<number>;
    hover(): Promise<void>;
    fill(value: string): Promise<void>;
    type(text: string, options?: {
        delay?: number;
    }): Promise<void>;
    selectOption(values: string | string[]): Promise<string[]>;
    scrollTo(percent: number | string): Promise<void>;
    isVisible(): Promise<boolean>;
    isChecked(): Promise<boolean>;
    inputValue(): Promise<string>;
    textContent(): Promise<string>;
    innerHtml(): Promise<string>;
    innerText(): Promise<string>;
    centroid(): Promise<{
        x: number;
        y: number;
    }>;
    backendNodeId(): Promise<number>;
    highlight(options?: {
        durationMs?: number;
        borderColor?: {
            r: number;
            g: number;
            b: number;
            a?: number;
        };
        contentColor?: {
            r: number;
            g: number;
            b: number;
            a?: number;
        };
    }): Promise<void>;
    sendClickEvent(options?: {
        bubbles?: boolean;
        cancelable?: boolean;
        composed?: boolean;
        detail?: number;
    }): Promise<void>;
    setInputFiles(files: string | string[] | {
        name: string;
        mimeType: string;
        buffer: ArrayBuffer | Uint8Array | Buffer | string;
    } | Array<{
        name: string;
        mimeType: string;
        buffer: ArrayBuffer | Uint8Array | Buffer | string;
    }>): Promise<void>;
    first(): DeepLocatorDelegate;
    nth(index: number): DeepLocatorDelegate;
}
/** Factory to create a deep locator delegate from a Page + root frame. */
export declare function deepLocatorFromPage(page: Page, root: Frame, selector: string): DeepLocatorDelegate;
