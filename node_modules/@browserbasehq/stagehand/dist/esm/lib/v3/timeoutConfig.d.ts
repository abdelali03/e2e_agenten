export declare function getEnvTimeoutMs(name: string): number | undefined;
export declare function withTimeout<T>(promise: Promise<T>, timeoutMs: number | null | undefined, operation: string): Promise<T>;
