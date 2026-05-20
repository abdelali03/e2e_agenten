import { InitScriptSource } from "../types/private/index.js";
export declare function normalizeInitScriptSource<Arg>(script: InitScriptSource<Arg>, arg?: Arg, caller?: string): Promise<string>;
