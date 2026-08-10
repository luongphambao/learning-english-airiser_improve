import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineSchema } from '../schema';

// Minimal shape for poking at the raw JSON Schema output in tests, without `any`.
interface JsonSchemaNode {
  [key: string]: unknown;
  properties?: Record<string, JsonSchemaNode>;
  items?: JsonSchemaNode;
}

describe('lib/ai/schema defineSchema', () => {
  const TestSchema = z.object({
    ipa: z.string(),
    distractors: z.array(z.string()).length(3),
    cefr: z.enum(['B1', 'B2', 'C1', 'C2']),
    nested: z.array(z.object({ phrase: z.string(), meaningVi: z.string() })),
  });

  it('OpenAI projection: every object has additionalProperties:false and a full required list', () => {
    const { json } = defineSchema('test_schema', TestSchema);
    expect(json.additionalProperties).toBe(false);
    expect(json.required).toEqual(expect.arrayContaining(['ipa', 'distractors', 'cefr', 'nested']));

    const nestedItems = (json as JsonSchemaNode).properties!.nested!.items!;
    expect(nestedItems.additionalProperties).toBe(false);
    expect(nestedItems.required).toEqual(['phrase', 'meaningVi']);
  });

  it('OpenAI projection strips minItems/maxItems recursively (strict mode rejects them)', () => {
    const { json } = defineSchema('test_schema', TestSchema);
    const distractors = (json as JsonSchemaNode).properties!.distractors!;
    expect(distractors.minItems).toBeUndefined();
    expect(distractors.maxItems).toBeUndefined();
  });

  it('OpenAI projection drops $schema', () => {
    const { json } = defineSchema('test_schema', TestSchema);
    expect(json.$schema).toBeUndefined();
  });

  it('Gemini projection uppercases type names', () => {
    const { gemini } = defineSchema('test_schema', TestSchema);
    expect(gemini.type).toBe('OBJECT');
    expect(gemini.properties?.ipa?.type).toBe('STRING');
    expect(gemini.properties?.distractors?.type).toBe('ARRAY');
    expect(gemini.properties?.distractors?.items?.type).toBe('STRING');
  });

  it('Gemini projection preserves enum values', () => {
    const { gemini } = defineSchema('test_schema', TestSchema);
    expect(gemini.properties?.cefr?.enum).toEqual(['B1', 'B2', 'C1', 'C2']);
  });

  it('Gemini projection sets propertyOrdering from declaration order', () => {
    const { gemini } = defineSchema('test_schema', TestSchema);
    expect(gemini.propertyOrdering).toEqual(['ipa', 'distractors', 'cefr', 'nested']);
  });

  it('the zod schema is the authority — a wrong-shaped "valid JSON" is still rejected', () => {
    const { zod } = defineSchema('test_schema', TestSchema);
    const result = zod.safeParse({ ipa: '/x/', distractors: ['a', 'b'], cefr: 'B2', nested: [] }); // only 2 distractors
    expect(result.success).toBe(false);
  });
});
