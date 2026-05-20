export type XPathPredicate = {
    type: "index";
    index: number;
} | {
    type: "attrEquals";
    name: string;
    value: string;
    normalize?: boolean;
} | {
    type: "attrExists";
    name: string;
} | {
    type: "attrContains";
    name: string;
    value: string;
    normalize?: boolean;
} | {
    type: "attrStartsWith";
    name: string;
    value: string;
    normalize?: boolean;
} | {
    type: "textEquals";
    value: string;
    normalize?: boolean;
} | {
    type: "textContains";
    value: string;
    normalize?: boolean;
} | {
    type: "and";
    predicates: XPathPredicate[];
} | {
    type: "or";
    predicates: XPathPredicate[];
} | {
    type: "not";
    predicate: XPathPredicate;
};
export interface XPathStep {
    axis: "child" | "desc";
    tag: string;
    predicates: XPathPredicate[];
}
/**
 * Parse an XPath expression into a list of traversal steps.
 *
 * This is a subset parser designed for composed DOM traversal (including
 * shadow roots). It intentionally does not implement the full XPath spec.
 *
 * Supported:
 *  - Child (`/`) and descendant (`//`) axes
 *  - Tag names and wildcard (`*`)
 *  - Positional indices (`[n]`)
 *  - Attribute equality predicates (`[@attr='value']`, `[@attr="value"]`)
 *  - Attribute existence (`[@attr]`)
 *  - Attribute contains/starts-with (`contains(@attr,'v')`, `starts-with(@attr,'v')`)
 *  - Text equality/contains (`[text()='v']`, `[contains(text(),'v')]`, `[.='v']`)
 *  - normalize-space on text/attributes (`[normalize-space(text())='v']`)
 *  - Basic boolean predicates (`and`, `or`, `not(...)`)
 *  - Multiple predicates per step (`[@class='foo'][2]`)
 *  - Optional `xpath=` prefix
 *
 * Not supported:
 *  - Position functions (`[position() > n]`, `[last()]`)
 *  - Axes beyond child/descendant (`ancestor::`, `parent::`, `self::`,
 *    `preceding-sibling::`, `following-sibling::`)
 *  - Union operator (`|`)
 *  - Grouped expressions (`(//div)[n]`)
 *
 * Unsupported predicates are silently ignored — the step still matches
 * by tag name, but the unrecognized predicate has no filtering effect.
 */
export declare function parseXPathSteps(input: string): XPathStep[];
export declare function evaluatePredicate(element: Element, predicate: XPathPredicate): boolean;
export declare function applyPredicates(elements: Element[], predicates: XPathPredicate[]): Element[];
