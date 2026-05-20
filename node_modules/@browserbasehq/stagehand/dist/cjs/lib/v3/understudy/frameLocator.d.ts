import type { Page } from "./page.js";
import { Frame } from "./frame.js";
/**
 * FrameLocator: resolves iframe elements to their child Frames and allows
 * creating locators scoped to that frame. Supports chaining.
 */
export declare class FrameLocator {
    private readonly parent?;
    private readonly selector;
    private readonly page;
    private readonly root?;
    constructor(page: Page, selector: string, parent?: FrameLocator, root?: Frame);
    /** Create a nested FrameLocator under this one. */
    frameLocator(selector: string): FrameLocator;
    /** Resolve to the concrete Frame for this FrameLocator chain. */
    resolveFrame(): Promise<Frame>;
    /** Return a Locator scoped to this frame. Methods delegate to the frame lazily. */
    locator(selector: string): LocatorDelegate;
}
/** A small delegating wrapper that resolves the frame lazily per call. */
declare class LocatorDelegate {
    private readonly fl;
    private readonly sel;
    private readonly nthIndex;
    constructor(fl: FrameLocator, sel: string, nthIndex?: number);
    private real;
    click(options?: {
        button?: "left" | "right" | "middle";
        clickCount?: number;
    }): Promise<void>;
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
    count(): Promise<number>;
    first(): LocatorDelegate;
    nth(index: number): LocatorDelegate;
}
/** Factory to start a FrameLocator chain from an arbitrary root Frame. */
export declare function frameLocatorFromFrame(page: Page, root: Frame, selector: string): FrameLocator;
export {};
