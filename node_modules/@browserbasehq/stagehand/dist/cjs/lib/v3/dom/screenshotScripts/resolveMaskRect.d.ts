export type MaskRect = {
    x: number;
    y: number;
    width: number;
    height: number;
    rootToken?: string | null;
};
export declare function resolveMaskRect(this: Element | null, maskToken?: string): MaskRect | null;
