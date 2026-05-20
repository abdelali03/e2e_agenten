import { z } from "zod/v4";
import type { VariableValue, Variables } from "./agent.js";
type VariablePrimitive = string | number | boolean;
export declare const VariablePrimitiveSchema: z.ZodType<VariablePrimitive>;
export declare const VariableValueSchema: z.ZodType<VariableValue>;
export declare const VariablesSchema: z.ZodType<Variables>;
export {};
