import 'server-only';
import { AiError, type ProviderId } from './errors';
import type { StructuredSchema } from './schema';

/**
 * The one place `JSON.parse` runs for a model response — replaces the unguarded
 * `JSON.parse(response.text)` that existed in all 5 of the old app/api/gemini/*
 * routes. Strips markdown code fences some models wrap JSON in, then validates
 * against the task's own zod schema (not just "is this valid JSON") so a
 * schema-obedient-looking but wrong-shaped response is still rejected.
 */
export function parseStructured<T>(
  schema: StructuredSchema<T>,
  text: string,
  providerId: ProviderId,
  taskId: string,
  requestId: string,
): T {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');

  let raw: unknown;
  try {
    raw = JSON.parse(cleaned);
  } catch (cause) {
    throw new AiError('invalid_output', { providerId, taskId, requestId, cause }, 'Model did not return valid JSON');
  }

  const result = schema.zod.safeParse(raw);
  if (!result.success) {
    throw new AiError(
      'invalid_output',
      { providerId, taskId, requestId, cause: result.error.issues },
      'Model output did not match the expected schema',
    );
  }
  return result.data;
}
