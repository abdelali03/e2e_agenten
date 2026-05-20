import type { CDPSessionLike } from "./cdp.js";
export declare function installV3PiercerIntoSession(session: CDPSessionLike): Promise<boolean>;
/** (Optional) stream patch logs in your node console during bring-up */
export declare function tapPiercerConsole(session: CDPSessionLike, label: string): void;
