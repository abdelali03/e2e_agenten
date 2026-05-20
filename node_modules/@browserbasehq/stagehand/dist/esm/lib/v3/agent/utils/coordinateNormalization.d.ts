import type { V3 } from "../../v3.js";
export declare function isGoogleProvider(provider?: string): boolean;
export declare function normalizeGoogleCoordinates(x: number, y: number, viewport: {
    width: number;
    height: number;
}): {
    x: number;
    y: number;
};
export declare function processCoordinates(x: number, y: number, provider?: string, v3?: V3): {
    x: number;
    y: number;
};
