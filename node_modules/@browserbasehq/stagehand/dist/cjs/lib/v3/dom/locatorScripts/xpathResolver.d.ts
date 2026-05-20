type ClosedRootGetter = (host: Element) => ShadowRoot | null;
export type XPathResolveOptions = {
    pierceShadow?: boolean;
};
export declare function resolveXPathFirst(rawXp: string, options?: XPathResolveOptions): Element | null;
export declare function resolveXPathAtIndex(rawXp: string, index: number, options?: XPathResolveOptions): Element | null;
export declare function countXPathMatches(rawXp: string, options?: XPathResolveOptions): number;
export declare function resolveXPathComposedMatches(rawXp: string, getClosedRoot?: ClosedRootGetter | null): Element[];
export {};
