import { CEFR_ORDER, type Cefr } from '@/lib/domain';
import type { CorpusEntry } from './types';

// A local band-order helper, not an import from lib/level/cefr.ts: lib/corpus/**
// must not depend on lib/level/** (the leveling engine reads/writes level signals —
// picking corpus words is a lower-level concern that lib/level's placement/top-up
// callers both sit on top of). CEFR_ORDER itself lives in lib/domain/word.ts, the
// one shared ordering everyone reads.
function nextBand(level: Cefr): Cefr | null {
  const idx = CEFR_ORDER.indexOf(level);
  return idx >= 0 && idx < CEFR_ORDER.length - 1 ? CEFR_ORDER[idx + 1] : null;
}

function eligibleSortedByRank(entries: readonly CorpusEntry[], exclude: ReadonlySet<string>): CorpusEntry[] {
  return entries.filter((e) => !exclude.has(e.word.toLowerCase())).slice().sort((a, b) => a.rank - b.rank);
}

export interface PickCorpusWordsInput {
  /** Band -> its loaded entries (lib/corpus/load.ts loadBand). Only `level` and
   * `level`+1 are ever read — this function never reaches below the user's level. */
  entries: Partial<Record<Cefr, readonly CorpusEntry[]>>;
  level: Cefr;
  exclude: ReadonlySet<string>;
  count: number;
}

/**
 * Pure, deterministic (no RNG), and never below `level` — see docs/decision.md
 * ADR-018. Desired-difficulty split: 70% from `level`, 30% from `level`+1 (the "i+1"
 * principle — a little beyond where the learner already is). If a band runs out of
 * eligible words before its share is filled, the shortfall is backfilled from
 * whatever's left in `level` rather than silently returning short of `count` when
 * more is actually available.
 */
export function pickCorpusWords(input: PickCorpusWordsInput): CorpusEntry[] {
  const { entries, level, exclude, count } = input;
  if (count <= 0) return [];

  const atLevelShare = Math.ceil(count * 0.7);
  const nextLevelShare = count - atLevelShare;

  const atLevel = eligibleSortedByRank(entries[level] ?? [], exclude);
  const next = nextBand(level);
  const atNext = next ? eligibleSortedByRank(entries[next] ?? [], exclude) : [];

  const picked: CorpusEntry[] = [];
  const pickedLower = new Set<string>();

  const take = (pool: readonly CorpusEntry[], upTo: number) => {
    for (const e of pool) {
      if (picked.length >= upTo) break;
      const key = e.word.toLowerCase();
      if (pickedLower.has(key)) continue;
      picked.push(e);
      pickedLower.add(key);
    }
  };

  take(atLevel, atLevelShare);
  take(atNext, atLevelShare + nextLevelShare);
  // Backfill from whatever's left at `level` if `level`+1 ran out short — never
  // returns fewer than possible just because the split was uneven.
  take(atLevel, count);

  return picked.slice(0, count);
}
