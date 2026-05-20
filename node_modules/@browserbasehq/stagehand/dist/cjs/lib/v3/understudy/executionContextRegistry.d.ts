import type { Protocol } from "devtools-protocol";
import type { CDPSessionLike } from "./cdp.js";
type FrameId = Protocol.Page.FrameId;
type ExecId = Protocol.Runtime.ExecutionContextId;
export declare class ExecutionContextRegistry {
    private readonly byFrame;
    private readonly byExec;
    /** Wire listeners for this session. Call BEFORE Runtime.enable. */
    attachSession(session: CDPSessionLike): void;
    getMainWorld(session: CDPSessionLike, frameId: FrameId): ExecId | null;
    waitForMainWorld(session: CDPSessionLike, frameId: FrameId, timeoutMs?: number): Promise<ExecId>;
    private register;
}
export declare const executionContexts: ExecutionContextRegistry;
export {};
