import { CEFR_ORDER, type Cefr, type CefrOrUnknown } from '@/lib/domain';

// Pure helpers over the shared CEFR_ORDER (lib/domain/word.ts) — no I/O, no wall
// clock. lib/level/** stays pure the same way lib/srs/** does (see eslint.config.mjs).

export function cefrIndex(level: Cefr): number {
  return CEFR_ORDER.indexOf(level);
}

export function clampCefr(index: number): Cefr {
  const clamped = Math.max(0, Math.min(CEFR_ORDER.length - 1, index));
  return CEFR_ORDER[clamped];
}

export function stepCefr(level: Cefr, delta: number): Cefr {
  return clampCefr(cefrIndex(level) + delta);
}

/** `Word.cefr` allows 'unknown' in the domain enum (docs/decision.md ADR-016) — this
 * is the one place that collapses it back to `Cefr | null` for level-signal code. */
export function knownCefr(cefr: CefrOrUnknown | undefined): Cefr | null {
  if (cefr === undefined || cefr === 'unknown') return null;
  return cefr;
}

export type FrequencyList = 'ngsl' | 'nawl' | 'bsl';

/**
 * Derives an internal difficulty band from a frequency-list rank — NOT a certified
 * CEFR level (docs/decision.md ADR-015). Exists for the future real-corpus path
 * (scripts/build-corpus.ts's header comment): this session's shipped corpus
 * (public/corpus/v1/**) is hand-banded, not rank-derived, so nothing calls this yet.
 */
export function cefrFromRank(rank: number, list: FrequencyList): Cefr {
  if (list === 'nawl') return 'C1';
  if (list === 'bsl') return rank <= 600 ? 'B1' : 'B2';
  // ngsl
  if (rank <= 600) return 'A2';
  if (rank <= 1400) return 'B1';
  return 'B2';
}
