import type { Variables, VariableValue } from "../../types/public/agent.js";
/**
 * Resolves a VariableValue to its primitive string value.
 * Handles both simple primitives ("secret") and rich objects ({ value: "secret", description: "..." }).
 */
export declare function resolveVariableValue(v: VariableValue): string;
/**
 * Extracts the optional description from a VariableValue.
 * Returns undefined for simple primitive values.
 */
export declare function getVariableDescription(v: VariableValue): string | undefined;
export interface VariablePromptEntry {
    name: string;
    description?: string;
}
export declare function getVariablePromptEntries(variables?: Variables): VariablePromptEntry[];
/**
 * Substitutes %variableName% tokens in text with resolved variable values.
 * Works with both simple and rich variable formats.
 */
export declare function substituteVariables(text: string, variables?: Variables): string;
/**
 * Flattens Variables to Record<string, string> for internal consumers
 * that only need key→value mappings (e.g., actHandler, cache replay).
 */
export declare function flattenVariables(variables?: Variables): Record<string, string> | undefined;
