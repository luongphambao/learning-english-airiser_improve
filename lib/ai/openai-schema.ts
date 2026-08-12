import 'server-only';

/**
 * Projects a plain JSON Schema (from z.toJSONSchema) onto the shape OpenAI's
 * `response_format: { type: 'json_schema', strict: true }` accepts.
 * OpenAI's strict mode rejects unsupported JSON schema keywords like `minItems`, `maxItems`,
 * `minLength`, `maxLength`, `pattern`, `format`, `minimum`, `maximum`, etc.
 */
export function strictifyForOpenAi(schema: Record<string, unknown>): Record<string, unknown> {
  const clone = structuredClone(schema);
  delete clone.$schema;
  stripUnsupportedKeywords(clone);
  return clone;
}

function stripUnsupportedKeywords(node: unknown): void {
  if (Array.isArray(node)) {
    for (const item of node) stripUnsupportedKeywords(item);
    return;
  }
  if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    delete obj.minItems;
    delete obj.maxItems;
    delete obj.minLength;
    delete obj.maxLength;
    delete obj.pattern;
    delete obj.format;
    delete obj.minimum;
    delete obj.maximum;
    delete obj.multipleOf;
    for (const value of Object.values(obj)) stripUnsupportedKeywords(value);
  }
}

