export interface TextMatchSample {
    tag: string;
    id: string;
    class: string;
    text: string;
}
export interface TextMatchResult {
    count: number;
    sample: TextMatchSample[];
    error: null;
}
export declare function countCssMatchesPrimary(selectorRaw: string): number;
export declare function countCssMatchesPierce(selectorRaw: string): number;
export declare function countTextMatches(rawNeedle: string): TextMatchResult;
export declare function countXPathMatchesMainWorld(rawXp: string): number;
