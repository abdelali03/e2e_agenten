import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { ToolSet } from "ai";
export declare const resolveTools: (clients: (Client | string)[], userTools: ToolSet) => Promise<ToolSet>;
