export type TimeoutGuard = () => void;
export declare function createTimeoutGuard(timeoutMs?: number, errorFactory?: (timeoutMs: number) => Error): TimeoutGuard;
