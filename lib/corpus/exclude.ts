import { getDb } from '@/lib/db/dexie';

/**
 * Every word the corpus top-up must never suggest: everything already in the
 * notebook (including soft-deleted rows — a word the user deleted must not come
 * back a week later, docs/decision.md ADR-018) plus everything in `skipped` ("Đã
 * biết rõ"). Two key-only reads, no row deserialization — for a 500-word notebook
 * this is on the order of milliseconds.
 */
export async function buildExclusionSet(): Promise<Set<string>> {
  const db = getDb();
  const [wordKeys, skippedRows] = await Promise.all([
    db.words.orderBy('wordLower').keys(),
    // Full rows, not primaryKeys() — a tombstoned row (v5, "un-skip") must stop
    // excluding its word, and a key-only read can't see `deletedAt` to filter it.
    db.skipped.toArray(),
  ]);
  const skippedKeys = skippedRows.filter((r) => !r.deletedAt).map((r) => r.wordLower);
  return new Set([...wordKeys, ...skippedKeys].map((k) => String(k)));
}
