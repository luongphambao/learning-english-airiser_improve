import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineSchema } from '../schema';
import { CefrSchema } from '@/lib/domain';
import { EnrichWordBatchOutput } from '../tasks/contracts';

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

  // Regression guard for a bug found (and fixed) in lib/ai/gemini-schema.ts: zod v4
  // emits `.nullable()` as `{anyOf:[<inner>, {type:'null'}]}` with no top-level
  // `type`, which the Gemini projection used to silently collapse to an empty
  // `{type:'OBJECT'}` — wrong for a nullable string, number, or object alike. No
  // shipped task uses .nullable() today, so this was never exercised in production;
  // guard it here so a future task can use it safely.
  const NullableSchema = z.object({
    maybeString: z.string().nullable(),
    maybeObject: z.object({ phrase: z.string() }).nullable(),
  });

  it('Gemini projection unwraps a nullable field to its real (non-null) type', () => {
    const { gemini } = defineSchema('nullable_schema', NullableSchema);
    expect(gemini.properties?.maybeString?.type).toBe('STRING');
  });

  it('Gemini projection unwraps a nullable object field to a real OBJECT with properties', () => {
    const { gemini } = defineSchema('nullable_schema', NullableSchema);
    expect(gemini.properties?.maybeObject?.type).toBe('OBJECT');
    expect(gemini.properties?.maybeObject?.properties?.phrase?.type).toBe('STRING');
  });

  it('no node in any defined task output schema is a typeless/property-less OBJECT', () => {
    // The failure mode this bug produced: {type:'OBJECT'} with `properties`
    // undefined. Walk the whole tree and assert that never happens.
    function assertNoEmptyObject(node: JsonSchemaNode | undefined, path: string) {
      if (!node) return;
      if (node.type === 'OBJECT' && !node.properties) {
        throw new Error(`Empty OBJECT node with no properties at ${path}`);
      }
      if (node.properties) {
        for (const [key, child] of Object.entries(node.properties)) {
          assertNoEmptyObject(child, `${path}.${key}`);
        }
      }
      if (node.items) assertNoEmptyObject(node.items, `${path}[]`);
    }
    const { gemini } = defineSchema('nullable_schema', NullableSchema);
    expect(() => assertNoEmptyObject(gemini as unknown as JsonSchemaNode, 'root')).not.toThrow();
  });

  // docs/decision.md ADR-019 — enrichWordBatch (lib/ai/tasks/registry.server.ts)
  // is the first task built on top of the widened CefrSchema; guard both together.
  it('CefrSchema projects as a Gemini enum', () => {
    const { gemini } = defineSchema('cefr_schema', z.object({ level: CefrSchema }));
    expect(gemini.properties?.level?.enum).toEqual(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
  });

  it('EnrichWordBatchOutput sets propertyOrdering with "word" first, per item', () => {
    const { gemini } = defineSchema('enrich_word_batch', EnrichWordBatchOutput);
    const itemSchema = gemini.properties?.items?.items;
    expect(itemSchema?.propertyOrdering?.[0]).toBe('word');
  });

  it('EnrichWordBatchOutput has no bare typeless OBJECT node anywhere in its tree', () => {
    function assertNoEmptyObject(node: JsonSchemaNode | undefined, path: string) {
      if (!node) return;
      if (node.type === 'OBJECT' && !node.properties) {
        throw new Error(`Empty OBJECT node with no properties at ${path}`);
      }
      if (node.properties) {
        for (const [key, child] of Object.entries(node.properties)) assertNoEmptyObject(child, `${path}.${key}`);
      }
      if (node.items) assertNoEmptyObject(node.items, `${path}[]`);
    }
    const { gemini } = defineSchema('enrich_word_batch', EnrichWordBatchOutput);
    expect(() => assertNoEmptyObject(gemini as unknown as JsonSchemaNode, 'root')).not.toThrow();
  });
});
