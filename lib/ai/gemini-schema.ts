import 'server-only';

export interface GeminiSchema {
  type: 'STRING' | 'NUMBER' | 'INTEGER' | 'BOOLEAN' | 'ARRAY' | 'OBJECT';
  description?: string;
  enum?: string[];
  properties?: Record<string, GeminiSchema>;
  required?: string[];
  propertyOrdering?: string[];
  items?: GeminiSchema;
}

const JSON_TYPE_TO_GEMINI: Record<string, GeminiSchema['type']> = {
  string: 'STRING',
  number: 'NUMBER',
  integer: 'INTEGER',
  boolean: 'BOOLEAN',
  array: 'ARRAY',
  object: 'OBJECT',
};

/**
 * Projects a plain JSON Schema (from z.toJSONSchema) onto `@google/genai`'s
 * `responseSchema` shape: uppercase type names, `enum` preserved, and
 * `propertyOrdering` set from the JSON Schema's own key order — Gemini's output
 * quality is sensitive to property order, so this keeps generation in the same
 * field order the zod schema was declared in. Drops `$schema`/`additionalProperties`
 * (Gemini doesn't understand them) after inlining any `$ref`/`$defs` a nested zod
 * object might have produced.
 */
export function toGeminiSchema(schema: Record<string, unknown>): GeminiSchema {
  return convert(schema);
}

/**
 * zod v4's z.toJSONSchema() emits `.nullable()` fields as `{ anyOf: [<inner>, {type:
 * 'null'}] }` — no top-level `type` key. Before this unwrap, `convert()` fell through
 * its `typeof node.type === 'string' ? node.type : 'object'` default straight to
 * `'object'`, and since such a node has no `properties` either, the result was a
 * bare `{type:'OBJECT'}` with nothing inside — silently wrong for Gemini, whatever
 * the field actually was. No shipped task uses `.nullable()` today so this was
 * latent, not active; lib/ai/__tests__/schema.test.ts guards it going forward.
 */
function unwrapNullableAnyOf(node: Record<string, unknown>): Record<string, unknown> {
  if (!Array.isArray(node.anyOf)) return node;
  const branches = node.anyOf as Record<string, unknown>[];
  const nonNull = branches.filter((b) => b.type !== 'null');
  return nonNull.length === 1 ? nonNull[0]! : node;
}

function convert(rawNode: Record<string, unknown>): GeminiSchema {
  const node = unwrapNullableAnyOf(rawNode);
  const jsonType = typeof node.type === 'string' ? node.type : 'object';
  const geminiType = JSON_TYPE_TO_GEMINI[jsonType] ?? 'STRING';

  const out: GeminiSchema = { type: geminiType };

  if (Array.isArray(node.enum)) {
    out.enum = node.enum.map(String);
  }

  if (geminiType === 'OBJECT' && node.properties && typeof node.properties === 'object') {
    const props = node.properties as Record<string, Record<string, unknown>>;
    const keys = Object.keys(props);
    out.properties = {};
    for (const key of keys) {
      out.properties[key] = convert(props[key]!);
    }
    out.propertyOrdering = keys;
    if (Array.isArray(node.required)) {
      out.required = node.required.map(String);
    }
  }

  if (geminiType === 'ARRAY' && node.items && typeof node.items === 'object') {
    out.items = convert(node.items as Record<string, unknown>);
  }

  return out;
}
