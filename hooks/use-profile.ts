'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { getRepos } from '@/lib/repositories';
import { DEFAULT_SETTINGS, DEFAULT_STATS } from '@/lib/repositories/dexie/user-repository';
import type { UserProfile } from '@/lib/repositories';

/** The `user` table has exactly one row — this is the single read the Tiến độ
 * screen needs (spec §8.4: never recompute stats by scanning `reviews`). */
export function useProfile(): UserProfile {
  const profile = useLiveQuery(() => getRepos().user.getProfile());
  return profile ?? { settings: DEFAULT_SETTINGS, stats: DEFAULT_STATS };
}

/** docs/decision.md ADR-028 — has the learner answered (or explicitly skipped) the
 * goal question? `undefined` while Dexie is still answering, which is the whole
 * reason this exists separately from `useProfile()`: that one substitutes
 * DEFAULT_SETTINGS during the load, and a default `setAt: null` is
 * indistinguishable from a real "never asked" — so the onboarding gate would flash
 * the form at someone who answered months ago. */
export function useOnboardingAnswered(): boolean | undefined {
  const profile = useLiveQuery(() => getRepos().user.getProfile());
  return profile ? profile.settings.learningGoal.setAt !== null : undefined;
}
