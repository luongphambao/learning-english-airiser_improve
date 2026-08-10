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

function convert(node: Record<string, unknown>): GeminiSchema {
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
