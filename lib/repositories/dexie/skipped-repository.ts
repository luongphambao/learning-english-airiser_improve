import { getDb } from '@/lib/db/dexie';
import type { SkippedRepository } from '../types';

// The `skipped` table (lib/db/dexie.ts v1) existed since the original schema but
// never had a repository — applyTriage('known', ...) (lib/srs/schedule.ts) has
// always returned null with the comment "caller writes to the `skipped` list
// instead", but no caller was ever written. This is that caller, added alongside the
// placement/triage flow (docs/decision.md ADR-017) that finally exercises it: "Đã
// biết rõ" during triage means "never suggest this again" from the corpus top-up.
export function createDexieSkippedRepository(): SkippedRepository {
  const db = getDb();

  return {
    async add(word, now) {
      await db.skipped.put({ wordLower: word.toLowerCase(), word, at: now });
    },

    async has(word) {
      const row = await db.skipped.get(word.toLowerCase());
      return row !== undefined;
    },

    async listLowercase() {
      return db.skipped.toCollection().primaryKeys();
    },

    async remove(word) {
      await db.skipped.delete(word.toLowerCase());
    },
  };
}
