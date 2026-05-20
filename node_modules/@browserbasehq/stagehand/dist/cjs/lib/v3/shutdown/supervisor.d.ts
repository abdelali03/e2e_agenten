/**
 * Shutdown supervisor process.
 *
 * This process watches a stdin lifeline. When the parent dies, stdin closes
 * and the supervisor performs best-effort cleanup:
 * - LOCAL: kill Chrome + remove temp profile
 * - STAGEHAND_API: request session release
 */
import type { ShutdownSupervisorConfig } from "../types/private/shutdown.js";
export declare const runShutdownSupervisor: (initialConfig: ShutdownSupervisorConfig) => void;
export declare const maybeRunShutdownSupervisorFromArgv: (argv?: readonly string[]) => boolean;
