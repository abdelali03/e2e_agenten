import { z } from "zod";
import type { ZodObject as Zod4Object, ZodRawShape as Zod4RawShape, ZodTypeAny as Zod4TypeAny } from "zod";
import type * as z3 from "zod/v3";
export type StagehandZodSchema = Zod4TypeAny | z3.ZodTypeAny;
export type StagehandZodObject = Zod4Object<Zod4RawShape> | z3.ZodObject<z3.ZodRawShape>;
export type InferStagehandSchema<T extends StagehandZodSchema> = T extends z3.ZodTypeAny ? z3.infer<T> : T extends Zod4TypeAny ? z.infer<T> : never;
export declare const isZod4Schema: (schema: StagehandZodSchema) => schema is Zod4TypeAny & {
    _zod: unknown;
};
export declare const isZod3Schema: (schema: StagehandZodSchema) => schema is z3.ZodTypeAny;
export type JsonSchemaDocument = Record<string, unknown>;
export declare function toJsonSchema(schema: StagehandZodSchema): JsonSchemaDocument;
