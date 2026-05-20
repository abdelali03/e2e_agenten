import type { Logger } from "../types/public/index.js";
import { ReadJsonResult, WriteJsonResult } from "../types/private/index.js";
export declare class CacheStorage {
    private readonly logger;
    private readonly dir?;
    private readonly memoryStore?;
    private constructor();
    static create(cacheDir: string | undefined, logger: Logger, options?: {
        label?: string;
    }): CacheStorage;
    static createMemory(logger: Logger): CacheStorage;
    get directory(): string | undefined;
    get enabled(): boolean;
    private resolvePath;
    readJson<T>(fileName: string): Promise<ReadJsonResult<T>>;
    writeJson(fileName: string, data: unknown): Promise<WriteJsonResult>;
}
