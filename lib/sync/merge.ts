import type { Review, UserStats } from '@/lib/domain';
import type { UserRow } from '@/lib/db/dexie';
import { nextStats } from '@/lib/srs/streak';
import type { GrammarAttemptRow, ImportRow, ReviewRow, SkippedRow, WordRow } from './types';

/**
 * Pure merge logic — no Firestore/Dexie I/O, `now` always a parameter, same
 * convention lib/srs/** and lib/level/** already follow (see
 * docs/architecture.md §3). lib/sync/engine.ts is the only caller; kept
 * separate so these rules are unit-testable without a database or network.
 */

/** Last-write-wins by `updatedAt`; ties favor `b` (the incoming/remote side) —
 * arbitrary but deterministic, and ties only happen if both sides wrote at
 * literally the same millisecond, which never matters in practice. */
function lww<T extends { updatedAt: number }>(a: T, b: T): T {
  return b.updatedAt >= a.updatedAt ? b : a;
}

/** Generic id-keyed union for append-only/immutable-after-creation
 * collections (reviews, imports, grammarAttempts) — no cross-row dedupe
 * concern like words has, since a review/import/attempt's id is only ever
 * minted once, on the device that created it. */
export function mergeById<T extends { id: string; updatedAt: number }>(local: T[], remote: T[]): T[] {
  const byId = new Map<string, T>();
  for (const row of local) byId.set(row.id, row);
  for (const row of remote) {
    const existing = byId.get(row.id);
    byId.set(row.id, existing ? lww(existing, row) : row);
  }
  return [...byId.values()];
}

/** `skipped` is keyed by `wordLower` itself (the Dexie primary key), so this
 * is mergeById in spirit but reading that field instead of `id`. */
export function mergeSkipped(local: SkippedRow[], remote: SkippedRow[]): SkippedRow[] {
  const byKey = new Map<string, SkippedRow>();
  for (const row of local) byKey.set(row.wordLower, row);
  for (const row of remote) {
    const existing = byKey.get(row.wordLower);
    byKey.set(row.wordLower, existing ? lww(existing, row) : row);
  }
  return [...byKey.values()];
}

export interface WordMergeResult {
  /** Every row that must be written to the local Dexie `words` table —
   * LWW winners plus any dedupe resolutions (merged canonical + tombstoned
   * loser), keyed by id (no duplicates). */
  toPersist: WordRow[];
  /** Dedupe resolutions ONLY — rows that must be pushed to Firestore right
   * away regardless of the normal "local rows changed since last push"
   * scan, because neither Firestore nor the other device knows about this
   * collision yet. engine.ts unions this into its push batch. */
  toPush: WordRow[];
}

/**
 * `words` is the one collection where two devices can independently create
 * the "same" word with two different ids — `&wordLower` is a unique index
 * locally, but Firestore has no equivalent constraint, so a pull can hand
 * back a row that collides with an existing local row on `wordLower` even
 * though their `id`s differ. Resolving that is this function's whole job;
 * every other collection's merge (mergeById/mergeSkipped above) is a plain
 * LWW because nothing else in this app can produce that kind of collision.
 *
 * `localAll` must be the FULL local `words` table (not just rows changed
 * since the last push) — dedupe correctness requires seeing every existing
 * `wordLower`, not only recently-touched ones. `remoteChanged` is the
 * delta pulled from Firestore (`updatedAt > pulledAt`).
 */
export function mergeWords(localAll: WordRow[], remoteChanged: WordRow[], now: number): WordMergeResult {
  const byId = new Map<string, WordRow>();
  for (const row of localAll) byId.set(row.id, row);

  // Only non-deleted local rows count as dedupe targets — a remote word
  // colliding with an already-tombstoned local wordLower is just a normal
  // "resurrect or not" LWW case (falls through to the id-based branch on a
  // later sync once ids converge), not a fresh collision to resolve.
  const byWordLower = new Map<string, WordRow>();
  for (const row of localAll) {
    if (!row.deletedAt) byWordLower.set(row.wordLower, row);
  }

  const toPersist = new Map<string, WordRow>();
  const toPush = new Map<string, WordRow>();

  for (const remote of remoteChanged) {
    const localSameId = byId.get(remote.id);
    if (localSameId) {
      // Direct id match — the same logical row on both sides, plain LWW.
      toPersist.set(remote.id, lww(localSameId, remote));
      continue;
    }

    const collision = remote.deletedAt ? undefined : byWordLower.get(remote.wordLower);
    if (!collision) {
      toPersist.set(remote.id, remote);
      continue;
    }

    // Genuine two-device collision: same word, two ids. The earlier-created
    // row stays canonical (keeps its id, so anything already referencing it
    // — e.g. a review's wordId — doesn't dangle); the later one is
    // tombstoned. SRS progress folds into the canonical row via max() per
    // field — a documented judgment call (docs/data-model.md): losing
    // practice history on either side is worse than a schedule that's
    // slightly more lenient than either side alone would have been.
    const [winner, loser] = remote.createdAt <= collision.createdAt ? [remote, collision] : [collision, remote];
    const merged: WordRow = {
      ...winner,
      reviewCount: Math.max(winner.reviewCount, loser.reviewCount),
      lapseCount: Math.max(winner.lapseCount, loser.lapseCount),
      dueAt: Math.max(winner.dueAt, loser.dueAt),
      consecutiveCorrect: Math.max(winner.consecutiveCorrect, loser.consecutiveCorrect),
      isLeech: winner.isLeech || loser.isLeech ? 1 : 0,
      updatedAt: now,
    };
    const tombstoned: WordRow = { ...loser, deletedAt: now, updatedAt: now };

    toPersist.set(merged.id, merged);
    toPersist.set(tombstoned.id, tombstoned);
    toPush.set(merged.id, merged);
    toPush.set(tombstoned.id, tombstoned);

    // A third colliding device's row (rare, but not impossible) must resolve
    // against this merge's outcome, not the stale pre-merge local row.
    byWordLower.set(merged.wordLower, merged);
    byId.set(merged.id, merged);
    byId.set(tombstoned.id, tombstoned);
  }

  return { toPersist: [...toPersist.values()], toPush: [...toPush.values()] };
}

const BLANK_STATS: UserStats = {
  streak: 0,
  longestStreak: 0,
  lastStudiedOn: null,
  freezeUsedOn: null,
  totalReviews: 0,
  totalCorrect: 0,
  daysStudied: 0,
  history: {},
};

/**
 * `UserStats`'s counters (totalReviews, totalCorrect, streak, history, ...)
 * are cumulative and sequential — LWW or per-field max() both under- or
 * over-count them the moment both devices logged independent reviews since
 * the last sync (docs/data-model.md flags this as the reasoning; max()
 * specifically undercounts, since it can't add two devices' independent
 * deltas together). The reviews collection (mergeById above) already merges
 * losslessly by id, so the correct fix is to not merge `stats` as data at
 * all — recompute it from scratch as a pure fold over the merged reviews,
 * using the exact same nextStats() the app already calls once per live
 * review (lib/srs/streak.ts). Sorting by answeredAt makes this
 * order-independent of which device the reviews came from.
 */
export function recomputeStatsFromReviews(reviews: Pick<Review, 'correct' | 'answeredAt'>[]): UserStats {
  const sorted = [...reviews].sort((a, b) => a.answeredAt - b.answeredAt);
  return sorted.reduce((acc, r) => nextStats(acc, r.correct, r.answeredAt), BLANK_STATS);
}

/** Settings merge is a plain LWW on the wrapping row's `updatedAt` (settings
 * and stats share one timestamp locally, UserRow); `stats` is always
 * replaced with the caller's already-recomputed value (recomputeStatsFromReviews
 * above), never LWW'd. */
export function mergeUserRow(local: UserRow, remote: UserRow, mergedStats: UserStats, now: number): UserRow {
  const settings = remote.updatedAt > local.updatedAt ? remote.settings : local.settings;
  return { id: local.id, settings, stats: mergedStats, updatedAt: now };
}

export type { GrammarAttemptRow, ImportRow, ReviewRow, SkippedRow, WordRow };
