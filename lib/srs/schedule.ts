import type { WordStatus } from '@/lib/domain';

// Pure scheduling — no I/O, no wall clock (`now` is always a parameter; enforced by
// the eslint no-restricted-syntax rule scoped to lib/srs/**). See docs/decision.md
// ADR-004/007 and docs/spec-gaps.md §D for the exact ambiguities this resolves.

export const INTERVALS_DAYS = [1, 3, 7, 16, 35, 90] as const;
export const LEECH_LAPSE_THRESHOLD = 4;
export const LEECH_CLEAR_STREAK = 2;
export const LEECH_RESET_LAPSE = 2;

const DAY_MS = 86_400_000;

export interface SrsState {
  easeLevel: number; // 0..5, index into INTERVALS_DAYS
  dueAt: number;
  reviewCount: number;
  lapseCount: number;
  consecutiveCorrect: number; // docs/decision.md ADR-007 — the field spec §8.2 needed but never named
  isLeech: boolean;
  status: WordStatus;
}

function statusFor(easeLevel: number): WordStatus {
  if (easeLevel <= 0) return 'new';
  if (easeLevel >= 4) return 'known';
  return 'learning';
}

/**
 * spec-gaps.md D1: `easeLevel` used to compute `dueAt` is the level AFTER this
 * answer, not before — a correct answer on a brand-new word (easeLevel 0) schedules
 * it INTERVALS_DAYS[1] = 3 days out, not INTERVALS_DAYS[0] = 1 day. This is the
 * reading that makes "answer correctly -> it does not reappear tomorrow" hold, which
 * is the Build-step-7 acceptance check.
 */
export function nextSchedule(s: SrsState, correct: boolean, now: number): SrsState {
  const easeLevel = correct
    ? Math.min(s.easeLevel + 1, INTERVALS_DAYS.length - 1)
    : Math.max(s.easeLevel - 2, 0);

  const consecutiveCorrectRaw = correct ? s.consecutiveCorrect + 1 : 0;
  let lapseCount = correct ? s.lapseCount : s.lapseCount + 1;
  let isLeech = s.isLeech || lapseCount >= LEECH_LAPSE_THRESHOLD;

  // spec §8.2: leech clears after 2 consecutive correct answers, and lapseCount
  // resets to 2 (not 0) — a cleared leech is still fragile, not a clean slate.
  if (isLeech && consecutiveCorrectRaw >= LEECH_CLEAR_STREAK) {
    isLeech = false;
    lapseCount = LEECH_RESET_LAPSE;
  }

  const interval = INTERVALS_DAYS[easeLevel] ?? INTERVALS_DAYS[INTERVALS_DAYS.length - 1];

  return {
    easeLevel,
    dueAt: now + interval * DAY_MS,
    reviewCount: s.reviewCount + 1,
    lapseCount,
    // Only tracked while a word IS a leech — irrelevant (and reset) otherwise, so a
    // long run of correct answers on a healthy word never silently arms leech-clear.
    consecutiveCorrect: isLeech ? consecutiveCorrectRaw : 0,
    isLeech,
    status: statusFor(easeLevel),
  };
}

export type KnownState = 'known' | 'partial' | 'unknown';

/**
 * spec §8.3 triage mapping. `partial` intentionally does NOT look up
 * INTERVALS_DAYS[easeLevel] (that would give 7 days for easeLevel 2) — the spec
 * pins its due date to exactly 3 days regardless, so these are two independent
 * numbers by design (spec-gaps.md D2).
 */
export function applyTriage(triage: KnownState, now: number): SrsState | null {
  if (triage === 'known') return null; // caller writes to the `skipped` list instead
  if (triage === 'partial') {
    return {
      easeLevel: 2,
      dueAt: now + 3 * DAY_MS,
      reviewCount: 0,
      lapseCount: 0,
      consecutiveCorrect: 0,
      isLeech: false,
      status: 'learning',
    };
  }
  return {
    easeLevel: 0,
    dueAt: now,
    reviewCount: 0,
    lapseCount: 0,
    consecutiveCorrect: 0,
    isLeech: false,
    status: 'new',
  };
}
