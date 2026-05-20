import type { Protocol } from "devtools-protocol";
import type { Frame } from "./frame.js";
export type SelectorQuery = {
    kind: "css";
    value: string;
} | {
    kind: "text";
    value: string;
} | {
    kind: "xpath";
    value: string;
};
export interface ResolvedNode {
    objectId: Protocol.Runtime.RemoteObjectId;
    nodeId: Protocol.DOM.NodeId | null;
}
export interface ResolveManyOptions {
    limit?: number;
}
export declare class FrameSelectorResolver {
    private readonly frame;
    constructor(frame: Frame);
    static parseSelector(raw: string): SelectorQuery;
    resolveFirst(query: SelectorQuery): Promise<ResolvedNode | null>;
    resolveAll(query: SelectorQuery, { limit }?: ResolveManyOptions): Promise<ResolvedNode[]>;
    count(query: SelectorQuery): Promise<number>;
    resolveAtIndex(query: SelectorQuery, index: number): Promise<ResolvedNode | null>;
    private buildLocatorInvocation;
    private resolveCss;
    private resolveText;
    private resolveXPath;
    private countCss;
    private countText;
    private countXPath;
    private resolveFromObjectId;
    private evaluateCount;
    private evaluateElement;
}
