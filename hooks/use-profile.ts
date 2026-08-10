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
