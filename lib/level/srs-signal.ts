import { CEFR_ORDER, type Cefr, type LevelSignal } from '@/lib/domain';

// Pure — `now` is always a parameter (see docs/decision.md ADR-004/007, enforced by
// eslint.config.mjs's no-restricted-syntax rule scoped to lib/level/**). The impure
// caller (stores/level-store.ts) reads the last ~200 reviews via the existing
// dayKey index, resolves each to its word's `cefr` via one `db.words.bulkGet(...)`,
// and passes the resulting samples here. No denormalization of `cefr` onto
// ReviewRow — a second indexed-field trap for an optimization nobody needs at N=200.

export interface ReviewSample {
  cefr: Cefr;
  correct: boolean;
}

const MIN_TOTAL_REVIEWS = 20; // below this, there simply isn't enough evidence yet
const MIN_BAND_SAMPLES = 10;
const ACCURACY_THRESHOLD = 0.7;

/**
 * The highest CEFR band where practice accuracy is convincingly good — the
 * strongest evidence that the user's real level has moved past what they declared.
 * Weight scales with total review volume (capped at 3, docs/decision.md ADR-017),
 * so a handful of lucky answers can't swing the level the way a placement result can.
 */
export function inferLevelFromReviews(samples: readonly ReviewSample[], now: number): LevelSignal | null {
  if (samples.length < MIN_TOTAL_REVIEWS) return null;

  const buckets = new Map<Cefr, { correct: number; total: number }>();
  for (const s of samples) {
    const b = buckets.get(s.cefr) ?? { correct: 0, total: 0 };
    b.total += 1;
    if (s.correct) b.correct += 1;
    buckets.set(s.cefr, b);
  }

  let best: Cefr | null = null;
  for (const band of CEFR_ORDER) {
    const b = buckets.get(band);
    if (b && b.total >= MIN_BAND_SAMPLES && b.correct / b.total >= ACCURACY_THRESHOLD) best = band;
  }
  if (!best) return null;

  return { level: best, weight: Math.min(Math.floor(samples.length / MIN_TOTAL_REVIEWS), 3), at: now };
}
