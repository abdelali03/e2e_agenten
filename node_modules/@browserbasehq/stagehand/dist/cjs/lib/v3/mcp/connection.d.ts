import { Client, ClientOptions } from "@modelcontextprotocol/sdk/client/index.js";
import { type StreamableHTTPClientTransportOptions } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
export interface ConnectToMCPServerOptions {
    serverUrl: string | URL;
    clientOptions?: ClientOptions;
    requestOptions?: StreamableHTTPClientTransportOptions;
}
export interface StdioServerConfig {
    command: string;
    args?: string[];
    env?: Record<string, string>;
}
export declare const connectToMCPServer: (serverConfig: string | URL | StdioServerConfig | ConnectToMCPServerOptions) => Promise<Client>;
