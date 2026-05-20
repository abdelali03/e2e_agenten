import { Part, FunctionCall, FunctionDeclaration } from "@google/genai";
import { ToolSet } from "ai";
import { LogLine } from "../../types/public/logs.js";
/**
 * Result of executing a custom tool for Google CUA
 */
export interface CustomToolExecutionResult {
    functionResponse: Part;
    success: boolean;
}
/**
 * Execute a custom tool and format the response for Google's API
 * This handles tool execution, result formatting, and error handling
 * specific to Google's function response format
 */
export declare function executeGoogleCustomTool(toolName: string, toolArgs: Record<string, unknown>, tools: ToolSet, functionCall: FunctionCall, logger: (message: LogLine) => void): Promise<CustomToolExecutionResult>;
/**
 * Check if a function call is a custom tool
 */
export declare function isCustomTool(functionCall: FunctionCall, tools?: ToolSet): boolean;
/**
 * Convert ToolSet to Google's FunctionDeclaration array
 * Handles the conversion of Zod schemas to Google's parameter format
 */
export declare function convertToolSetToFunctionDeclarations(tools: ToolSet): FunctionDeclaration[];
