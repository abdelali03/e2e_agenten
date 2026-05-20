import type { LogLine } from "./types/public/logs.js";
export declare function bindInstanceLogger(instanceId: string, logger: (line: LogLine) => void): void;
export declare function unbindInstanceLogger(instanceId: string): void;
export declare function withInstanceLogContext<T>(instanceId: string, fn: () => T): T;
/**
 * Routes logs to the appropriate instance logger based on AsyncLocalStorage context.
 * Falls back to console output if no instance context is available.
 */
export declare function v3Logger(line: LogLine): void;
