import 'server-only';

/**
 * Projects a plain JSON Schema (from z.toJSONSchema) onto the shape OpenAI's
 * `response_format: { type: 'json_schema', strict: true }` accepts. zod v4 already
 * emits `additionalProperties: false` and a full `required` list on every object
 * (verified against zod@4.4.3) — the one thing strict mode still rejects is
 * `minItems`/`maxItems` on arrays, so those are stripped recursively. Count
 * constraints (e.g. "exactly 3 distractors") move to a post-parse `repair()` step
 * on the task definition instead — see docs/decision.md ADR-009.
 */
export function strictifyForOpenAi(schema: Record<string, unknown>): Record<string, unknown> {
  const clone = structuredClone(schema);
  delete clone.$schema;
  stripArrayCountConstraints(clone);
  return clone;
}

function stripArrayCountConstraints(node: unknown): void {
  if (Array.isArray(node)) {
    for (const item of node) stripArrayCountConstraints(item);
    return;
  }
  if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    delete obj.minItems;
    delete obj.maxItems;
    for (const value of Object.values(obj)) stripArrayCountConstraints(value);
  }
}
