import { Buffer } from "buffer";
import { SetInputFilesArgument } from "../types/public/locator.js";
import { NormalizedFilePayload } from "../types/private/locator.js";
/**
 * Normalize user-provided setInputFiles arguments into in-memory payloads.
 * - Resolves string paths relative to the provided base directory.
 * - Validates that each path exists and is a regular file.
 * - Converts all buffers into Node Buffers for downstream processing.
 */
export declare function normalizeInputFiles(files: SetInputFilesArgument, opts?: {
    baseDir?: string;
}): Promise<NormalizedFilePayload[]>;
export declare function toBuffer(data: ArrayBuffer | Uint8Array | Buffer | string): Buffer;
