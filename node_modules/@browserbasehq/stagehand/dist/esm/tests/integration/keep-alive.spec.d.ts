export type EnvKind = "LOCAL" | "BROWSERBASE";
export type ScenarioKind = "unhandled" | "close" | "sigterm" | "sigint";
export type KeepAliveCase = {
    title: string;
    env: EnvKind;
    envLabel: string;
    keepAlive: boolean;
    disableAPI: boolean;
    kind: ScenarioKind;
    requiresBrowserbase: boolean;
};
export declare function getKeepAliveEnvConfig(): {
    testEnv: EnvKind;
    apiKey?: string;
    projectId?: string;
    hasBrowserbaseCreds: boolean;
};
export declare function buildKeepAliveCases(testEnv: EnvKind): KeepAliveCase[];
export declare function runKeepAliveCase(testCase: KeepAliveCase, envConfig: {
    apiKey?: string;
    projectId?: string;
}): Promise<void>;
