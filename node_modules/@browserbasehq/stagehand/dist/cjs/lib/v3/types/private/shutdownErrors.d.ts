/**
 * Internal-only errors for the shutdown supervisor.
 */
export declare class ShutdownSupervisorError extends Error {
    constructor(message: string);
}
export declare class ShutdownSupervisorResolveError extends ShutdownSupervisorError {
    constructor(message: string);
}
export declare class ShutdownSupervisorSpawnError extends ShutdownSupervisorError {
    constructor(message: string);
}
