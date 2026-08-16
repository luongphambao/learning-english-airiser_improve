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
      // put(), not add() — re-skipping a word that was previously un-skipped
      // (deletedAt set) must resurrect the same row rather than error on the
      // &wordLower unique constraint.
      await db.skipped.put({ wordLower: word.toLowerCase(), word, at: now, deletedAt: null, updatedAt: now });
    },

    async has(word) {
      const row = await db.skipped.get(word.toLowerCase());
      return row !== undefined && !row.deletedAt;
    },

    async listLowercase() {
      const rows = await db.skipped.toArray();
      return rows.filter((r) => !r.deletedAt).map((r) => r.wordLower);
    },

    // Tombstone, not hard-delete (v5 — lib/db/dexie.ts) — "un-skip" needs a row
    // to sync as an undo to another device, same reasoning as Word.remove()'s
    // soft delete. `at`/`word` are left untouched; only `deletedAt`/`updatedAt`
    // change, so re-skipping later (add() above) still resurrects real history
    // instead of a blank row.
    async remove(word, now) {
      const wordLower = word.toLowerCase();
      const existing = await db.skipped.get(wordLower);
      if (!existing) return;
      await db.skipped.put({ ...existing, deletedAt: now, updatedAt: now });
    },
  };
}
