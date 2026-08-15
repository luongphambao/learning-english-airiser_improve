import type { Cefr, LevelProfile } from '@/lib/domain';
import { cefrIndex, clampCefr } from './cefr';

// Pure — `now` is always a parameter. docs/decision.md ADR-017 for the full rule
// list (R1-R8); each rule below is independently unit-tested in
// lib/level/__tests__/resolve.test.ts.

const COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000; // R5 — anti-flapping
const SUGGESTION_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
const PLACEMENT_FRESH_MS = 90 * 24 * 60 * 60 * 1000;
const MOVE_UP_WEIGHT_FLOOR = 2; // R6
const MOVE_DOWN_WEIGHT_FLOOR = 3; // R7 — stricter: a wrong downgrade hurts more than a slow upgrade

interface WeightedLevel {
  level: Cefr;
  weight: number;
}

function weightedSignals(profile: LevelProfile, now: number): WeightedLevel[] {
  const out: WeightedLevel[] = [];
  if (profile.placement) {
    const fresh = now - profile.placement.at <= PLACEMENT_FRESH_MS;
    out.push({ level: profile.placement.level, weight: fresh ? 3 : 1 });
  }
  if (profile.work) out.push({ level: profile.work.level, weight: profile.work.weight });
  if (profile.srs) out.push({ level: profile.srs.level, weight: profile.srs.weight });
  return out;
}

/**
 * R3 — a weighted MEDIAN, not a mean: CEFR is ordinal, so a mean can land on a band
 * no signal actually named and gets dragged by a single outlier. Expanding each
 * signal into `round(weight)` copies of its band index and taking the middle of the
 * sorted multiset is the ordinal analogue of a weighted median.
 */
function weightedMedianLevel(signals: readonly WeightedLevel[]): Cefr | null {
  if (signals.length === 0) return null;
  const expanded: number[] = [];
  for (const s of signals) {
    const copies = Math.max(1, Math.round(s.weight));
    for (let i = 0; i < copies; i++) expanded.push(cefrIndex(s.level));
  }
  expanded.sort((a, b) => a - b);
  const mid = Math.floor((expanded.length - 1) / 2);
  return clampCefr(expanded[mid]);
}

export interface ResolveLevelInput {
  profile: LevelProfile;
  current: Cefr;
  now: number;
}

export interface ResolveLevelResult {
  level: Cefr;
  /** Caller persists this alongside `level` in the same updateSettings() patch. */
  levelProfile: LevelProfile;
  changed: boolean;
  /** Non-null only when a manual `declared` disagrees with strong auto evidence and
   * the 14-day suggestion cooldown has elapsed — the UI shows a dismissible nudge,
   * never a silent change (docs/decision.md ADR-017, unlike the streak freeze). */
  suggestion: Cefr | null;
}

export function resolveLevel(input: ResolveLevelInput): ResolveLevelResult {
  const { profile, current, now } = input;

  // R1 — a manual declaration pins `level`, full stop. Auto signals keep
  // accumulating (callers still write them) but never move `level` here.
  if (profile.declared !== null) {
    const signals = weightedSignals(profile, now);
    const totalWeight = signals.reduce((s, x) => s + x.weight, 0);
    const candidate = weightedMedianLevel(signals);
    const disagrees = candidate !== null && candidate !== profile.declared && totalWeight >= MOVE_UP_WEIGHT_FLOOR;
    const cooledDown = profile.lastPromptedAt === null || now - profile.lastPromptedAt >= SUGGESTION_COOLDOWN_MS;
    const suggestion = disagrees && cooledDown ? candidate : null;

    return {
      level: profile.declared,
      levelProfile: suggestion ? { ...profile, lastPromptedAt: now } : profile,
      changed: false,
      suggestion,
    };
  }

  const signals = weightedSignals(profile, now);
  const totalWeight = signals.reduce((s, x) => s + x.weight, 0);
  const candidate = weightedMedianLevel(signals);
  if (candidate === null) {
    return { level: current, levelProfile: profile, changed: false, suggestion: null };
  }

  // R2 — no declaration and no prior automatic resolution: this is the seed moment,
  // typically a fresh placement result. Skips the cooldown (nothing to cool down
  // from yet) but NOT the evidence floor below — weak evidence still doesn't seed.
  const isFirstEverResolution = profile.updatedAt === null;
  const cooledDown = isFirstEverResolution || now - profile.updatedAt! >= COOLDOWN_MS;
  if (!cooledDown) {
    return { level: current, levelProfile: profile, changed: false, suggestion: null };
  }

  const currentIdx = cefrIndex(current);
  const candidateIdx = cefrIndex(candidate);
  const isDown = candidateIdx < currentIdx;

  // R6/R7 — evidence floor, stricter for a down-move (any downward candidate already
  // differs by a full band or more, since CEFR bands are discrete).
  const floor = isDown ? MOVE_DOWN_WEIGHT_FLOOR : MOVE_UP_WEIGHT_FLOOR;
  if (totalWeight < floor) {
    return { level: current, levelProfile: profile, changed: false, suggestion: null };
  }

  // R4 — one step at a time, EXCEPT on the seed moment (R2): a fresh placement
  // should land where it says, not creep toward it from an untouched default.
  const nextIdx = isFirstEverResolution
    ? candidateIdx
    : Math.max(currentIdx - 1, Math.min(currentIdx + 1, candidateIdx));
  const next = clampCefr(nextIdx);

  if (next === current) {
    return { level: current, levelProfile: profile, changed: false, suggestion: null };
  }

  // R8 (mid-session freeze) is not this function's concern — it's a free consequence
  // of ADR-004: callers only invoke resolveLevel between sessions, never mid-session.
  return { level: next, levelProfile: { ...profile, updatedAt: now }, changed: true, suggestion: null };
}
