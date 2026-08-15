import { create } from 'zustand';
import { getRepos } from '@/lib/repositories';
import { resolveLevel } from '@/lib/level/resolve';
import { inferLevelFromReviews } from '@/lib/level/srs-signal';
import { knownCefr } from '@/lib/level/cefr';
import type { Cefr, LevelProfile } from '@/lib/domain';
import type { PlacementScore } from '@/lib/level/placement';

// docs/decision.md ADR-017 — the single impure orchestrator for level signals,
// following the enrichment-store/work-store convention: the store owns the flow
// (read current profile, resolve, persist); nothing else touches
// settings.levelProfile directly.

interface LevelStoreState {
  recordPlacement(score: PlacementScore, now: number): Promise<void>;
  recordWorkSignal(estimatedLevel: Cefr, now: number): Promise<void>;
  refreshSrsSignal(now: number): Promise<void>;
  setDeclared(level: Cefr, now: number): Promise<void>;
}

const SRS_REVIEW_WINDOW = 200;
// R3 (docs/decision.md ADR-017): work weight is min(samples,3)*0.5. One analyzeWork
// call is one sample — a full 3-sample cap would need three separate analyses each
// agreeing before the signal's own weight alone could ever clear the up-move floor.
const WORK_SIGNAL_WEIGHT = 0.5;

async function applyLevelProfilePatch(patch: Partial<LevelProfile>, now: number): Promise<void> {
  const repos = getRepos();
  const { settings } = await repos.user.getProfile();
  const merged: LevelProfile = { ...settings.levelProfile, ...patch };
  const resolved = resolveLevel({ profile: merged, current: settings.level, now });
  await repos.user.updateSettings({ level: resolved.level, levelProfile: resolved.levelProfile });
}

export const useLevelStore = create<LevelStoreState>()(() => ({
  async recordPlacement(score, now) {
    // resolveLevel recomputes placement's effective weight from `at` (fresh vs
    // stale) rather than trusting a stored number — see lib/level/resolve.ts — so
    // the weight written here only matters as a non-zero placeholder.
    await applyLevelProfilePatch({ placement: { level: score.level, weight: 3, at: now } }, now);
  },

  async recordWorkSignal(estimatedLevel, now) {
    await applyLevelProfilePatch({ work: { level: estimatedLevel, weight: WORK_SIGNAL_WEIGHT, at: now } }, now);
  },

  /** Called at session end (session-store.answer() when status becomes 'done') —
   * costs nothing per card, and any "level changed" note lands on the completion
   * screen where the user is already looking. */
  async refreshSrsSignal(now) {
    const repos = getRepos();
    const recent = await repos.reviews.listRecent(SRS_REVIEW_WINDOW);
    if (recent.length === 0) return;

    const uniqueWordIds = [...new Set(recent.map((r) => r.wordId))];
    const words = await Promise.all(uniqueWordIds.map((id) => repos.words.get(id)));
    const cefrByWordId = new Map(
      words.filter((w): w is NonNullable<typeof w> => w !== null).map((w) => [w.id, knownCefr(w.cefr)]),
    );

    const samples = recent
      .map((r) => {
        const cefr = cefrByWordId.get(r.wordId);
        return cefr ? { cefr, correct: r.correct } : null;
      })
      .filter((s): s is { cefr: Cefr; correct: boolean } => s !== null);

    const signal = inferLevelFromReviews(samples, now);
    if (!signal) return; // not enough evidence yet — leave levelProfile.srs untouched
    await applyLevelProfilePatch({ srs: signal }, now);
  },

  async setDeclared(level, now) {
    await applyLevelProfilePatch({ declared: level }, now);
  },
}));
