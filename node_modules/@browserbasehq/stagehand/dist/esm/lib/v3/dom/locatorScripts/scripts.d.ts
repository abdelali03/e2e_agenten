export interface ClickEventOptions {
    bubbles?: boolean;
    cancelable?: boolean;
    composed?: boolean;
    detail?: number;
}
export declare function ensureFileInputElement(this: Element): boolean;
export interface SerializedFilePayload {
    name: string;
    mimeType: string;
    base64: string;
    lastModified?: number;
}
/** Attach File objects created from serialized payloads to an <input type="file">. */
export declare function assignFilePayloadsToInputElement(this: Element, payloads: SerializedFilePayload[]): boolean;
export declare function dispatchDomClick(this: Element, options?: ClickEventOptions): void;
export declare function scrollElementToPercent(this: Element, percent: number | string): boolean;
export type FillElementResult = {
    status: "done";
} | {
    status: "needsinput";
    value: string;
    reason?: string;
} | {
    status: "error";
    reason: string;
};
export declare function prepareElementForTyping(this: Element): boolean;
export declare function fillElementValue(this: Element, rawValue: string): FillElementResult;
export declare function focusElement(this: Element): void;
export declare function selectElementOptions(this: Element, rawValues: string | string[]): string[];
export declare function isElementVisible(this: Element): boolean;
export declare function isElementChecked(this: Element): boolean;
export declare function readElementInputValue(this: Element): string;
export declare function readElementTextContent(this: Element): string;
export declare function readElementInnerHTML(this: Element): string;
export declare function readElementInnerText(this: Element): string;
