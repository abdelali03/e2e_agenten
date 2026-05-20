/**
 * Parent-side helper for spawning the shutdown supervisor process.
 *
 * The supervisor runs out-of-process and watches a lifeline pipe. If the parent
 * dies, the supervisor performs best-effort cleanup (Chrome kill or Browserbase
 * session release) when keepAlive is false.
 */
import type { ShutdownSupervisorConfig, ShutdownSupervisorHandle } from "../types/private/shutdown.js";
/**
 * Start a supervisor process for crash cleanup. Returns a handle that can
 * stop the supervisor during a normal shutdown.
 */
export declare function startShutdownSupervisor(config: ShutdownSupervisorConfig, opts?: {
    onError?: (error: Error, context: string) => void;
}): ShutdownSupervisorHandle | null;
