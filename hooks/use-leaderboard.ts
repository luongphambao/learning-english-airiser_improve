'use client';

import { useCallback, useEffect, useState } from 'react';
import { getFirebaseAuth, getFirebaseFirestore } from '@/lib/firebase/client';
import { fetchRecentDocs } from '@/lib/leaderboard/remote';
import { entryFromDoc } from '@/lib/leaderboard/map';
import type { LeaderboardEntry } from '@/lib/leaderboard/types';

// "Most recently active" cut, not "everyone ever" — see lib/leaderboard/remote.ts's
// fetchRecentDocs doc comment. Surfaced in the UI as a disclosure line
// (leaderboardPage.capNotice) per docs/decision.md ADR-025, not hidden.
export const LEADERBOARD_FETCH_LIMIT = 200;

export type LeaderboardFetchStatus = 'loading' | 'ready' | 'error' | 'signed-out';

export interface UseLeaderboardResult {
  status: LeaderboardFetchStatus;
  /** Other real learners, already mapped to LeaderboardEntry — NOT ranked yet and
   * does NOT include the current user's own row (lib/leaderboard/metrics.ts's
   * buildMyEntry/buildLeaderboard build and merge that separately from live
   * Dexie data, same split as before this hook existed). */
  entries: LeaderboardEntry[];
  reload: () => void;
}

/**
 * One-shot fetch of the shared `leaderboard` Firestore collection — a plain hook
 * with local state, not a Zustand store: this data belongs to exactly one screen
 * and shouldn't outlive it, same shape as
 * components/layout/legacy-claim-banner.tsx's mount-time fetch (cancellation
 * flag, no caching layer). Reading who's signed in from
 * `getFirebaseAuth().currentUser` is safe here because app/providers.tsx never
 * renders a screen until Firebase Auth has already resolved once.
 */
export function useLeaderboard(): UseLeaderboardResult {
  const [status, setStatus] = useState<LeaderboardFetchStatus>('loading');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const uid = getFirebaseAuth().currentUser?.uid;
    if (!uid) {
      setStatus('signed-out');
      setEntries([]);
      return;
    }

    let cancelled = false;
    setStatus('loading');

    fetchRecentDocs(getFirebaseFirestore(), LEADERBOARD_FETCH_LIMIT)
      .then((rawDocs) => {
        if (cancelled) return;
        const now = Date.now();
        const mapped = rawDocs
          .map((raw) => entryFromDoc(raw, uid, now))
          .filter((e): e is LeaderboardEntry => e !== null);
        setEntries(mapped);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[lexio] leaderboard fetch failed:', err);
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  return { status, entries, reload };
}
