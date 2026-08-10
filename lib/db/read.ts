import { z } from 'zod';
import type { LexioDb } from './dexie';

export type SafeParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: z.ZodIssue[]; raw: unknown };

/**
 * Parse a row read from Dexie against its domain zod schema. A corrupt/stale row
 * (e.g. from an old schema version, or manual tampering) must never throw into a
 * React render and must never be silently dropped — see docs/data-model.md §4.
 *
 * Order: parse as-is -> on failure, run `repair` (fills in defaults for fields a
 * partial migration missed) -> parse again -> on failure, caller quarantines it.
 */
export function safeParseRow<T>(
  schema: z.ZodType<T>,
  raw: unknown,
  repair?: (raw: unknown) => unknown,
): SafeParseResult<T> {
  const first = schema.safeParse(raw);
  if (first.success) return { ok: true, value: first.data };

  if (repair) {
    const second = schema.safeParse(repair(raw));
    if (second.success) return { ok: true, value: second.data };
  }

  return { ok: false, issues: first.error.issues, raw };
}

/**
 * Records a row that failed validation (even after repair) under
 * meta['quarantine:<table>:<id>'] instead of losing it, and drops it from the
 * result set the caller returns. Never deletes the original row from its table —
 * a future migration might still be able to repair it.
 */
export async function quarantineRow(
  db: LexioDb,
  table: string,
  id: string,
  raw: unknown,
  issues: z.ZodIssue[],
): Promise<void> {
  console.warn(`[lexio/db] quarantined ${table}/${id}:`, issues.map((i) => i.message).join('; '));
  await db.meta.put({
    key: `quarantine:${table}:${id}`,
    value: { raw, issues: issues.map((i) => ({ path: i.path, message: i.message })), at: Date.now() },
  });
}
