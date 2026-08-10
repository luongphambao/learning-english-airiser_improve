import 'server-only';
import { z } from 'zod';
import { strictifyForOpenAi } from './openai-schema';
import { toGeminiSchema, type GeminiSchema } from './gemini-schema';

export interface StructuredSchema<T> {
  readonly name: string; // json_schema.name — must match [a-zA-Z0-9_-]{1,64}
  readonly zod: z.ZodType<T>; // authoritative — validates the parsed model output
  readonly json: Record<string, unknown>; // OpenAI strict JSON Schema
  readonly gemini: GeminiSchema; // Gemini responseSchema
}

/**
 * One zod schema, two projections — see docs/decision.md ADR-009. Keeps the
 * baseline's real weakness (the same response shape hand-duplicated across the
 * route's responseSchema, types.ts, and a component-local interface, all free to
 * drift) from recurring: every task defines its output shape exactly once.
 */
export function defineSchema<T>(name: string, schema: z.ZodType<T>): StructuredSchema<T> {
  const base = z.toJSONSchema(schema, { target: 'draft-2020-12' }) as Record<string, unknown>;
  return {
    name,
    zod: schema,
    json: strictifyForOpenAi(base),
    gemini: toGeminiSchema(base),
  };
}
