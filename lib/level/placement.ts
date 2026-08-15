import { CEFR_ORDER, type Cefr } from '@/lib/domain';
import type { CorpusEntry } from '@/lib/corpus/types';
import { cefrIndex, clampCefr } from './cefr';

// Pure — no I/O, no wall clock. See docs/decision.md ADR-017 for the two-screen
// placement flow this backs (app/(stack)/placement/page.tsx): a 20-item yes/no
// vocabulary check, scored here, then a spec-§8.3 triage of the words the user
// marked unknown.

export interface PlacementItem {
  word: string;
  vi: string;
  cefr: Cefr;
}

const PLACEMENT_BANDS = CEFR_ORDER.filter((b) => b !== 'A1'); // the corpus never ships an A1 band

/**
 * Builds a deterministic (no RNG) placement test: `perBand` words from each band,
 * lowest-rank-first, interleaved band-by-band (A2,B1,B2,C1,C2,A2,B1,...) rather than
 * grouped low-to-high — this hides the strict ladder from the user without needing
 * randomness, which would make the function untestable and non-reproducible.
 */
export function buildPlacementItems(
  entries: Partial<Record<Cefr, readonly CorpusEntry[]>>,
  perBand = 4,
): PlacementItem[] {
  const items: PlacementItem[] = [];
  for (let i = 0; i < perBand; i++) {
    for (const band of PLACEMENT_BANDS) {
      const pool = entries[band] ?? [];
      const sorted = [...pool].sort((a, b) => a.rank - b.rank);
      const picked = sorted[i];
      if (picked) items.push({ word: picked.word, vi: picked.vi, cefr: band });
    }
  }
  return items;
}

export interface PlacementAnswer {
  cefr: Cefr;
  known: boolean;
}

export interface PlacementScore {
  level: Cefr;
  confidence: number; // 0..1, informational only — never gates whether a result applies
  perBand: Partial<Record<Cefr, { known: number; total: number }>>;
}

const KNOWN_THRESHOLD = 0.6;
const MIN_ANSWERED_FOR_CONFIDENCE = 12;

/**
 * The highest band with a "clean" knownRatio >= 0.6 climbing up from A2, PROVIDED no
 * higher band also clears 0.6 (a spurious/non-monotonic result — e.g. guessed right
 * on advanced words while missing intermediate ones) — that case falls back to a
 * weighted mean of per-band ratios instead of trusting the misleading cutoff.
 * Floors at A2 (never A1: this is an adult professional learner, not a beginner
 * placement) and never exceeds C2.
 */
export function scorePlacement(items: readonly PlacementAnswer[]): PlacementScore {
  const perBand: Partial<Record<Cefr, { known: number; total: number }>> = {};
  for (const item of items) {
    const bucket = perBand[item.cefr] ?? { known: 0, total: 0 };
    bucket.total += 1;
    if (item.known) bucket.known += 1;
    perBand[item.cefr] = bucket;
  }

  const answeredBands = CEFR_ORDER.filter((b) => (perBand[b]?.total ?? 0) > 0);
  const ratioOf = (b: Cefr) => (perBand[b] ? perBand[b]!.known / perBand[b]!.total : 0);

  let cutoff: Cefr | null = null;
  for (const band of answeredBands) {
    if (ratioOf(band) >= KNOWN_THRESHOLD) cutoff = band;
    else break; // first band under threshold stops the climb
  }

  const nonMonotonic = cutoff
    ? answeredBands.some((b) => cefrIndex(b) > cefrIndex(cutoff!) && ratioOf(b) >= KNOWN_THRESHOLD)
    : answeredBands.some((b, i) => i > 0 && ratioOf(b) >= KNOWN_THRESHOLD);

  const lowConfidence = items.length < MIN_ANSWERED_FOR_CONFIDENCE;

  if (cutoff && !nonMonotonic) {
    return { level: cutoff, confidence: lowConfidence ? 0.4 : 0.85, perBand };
  }

  if (answeredBands.length === 0) {
    return { level: 'A2', confidence: 0.2, perBand };
  }

  const totalWeight = answeredBands.reduce((s, b) => s + perBand[b]!.total, 0);
  const weightedIndexSum = answeredBands.reduce((s, b) => s + cefrIndex(b) * ratioOf(b) * perBand[b]!.total, 0);
  const meanIndex = totalWeight > 0 ? weightedIndexSum / totalWeight : cefrIndex('A2');
  const level = clampCefr(Math.max(cefrIndex('A2'), Math.round(meanIndex)));

  return { level, confidence: nonMonotonic ? 0.35 : lowConfidence ? 0.3 : 0.5, perBand };
}
