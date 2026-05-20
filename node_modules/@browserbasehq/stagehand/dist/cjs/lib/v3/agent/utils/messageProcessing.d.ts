import type { ModelMessage } from "ai";
/**
 * Compress old screenshot/ariaTree data in messages in-place.
 *
 * Strategy:
 * - Keep only the 2 most recent vision results (screenshots OR vision action tools like click/type/etc)
 * - Keep only the 1 most recent ariaTree (replace older ones with placeholder)
 *
 * @param messages - The messages array to modify in-place
 * @returns Number of items compressed
 */
export declare function processMessages(messages: ModelMessage[]): number;
