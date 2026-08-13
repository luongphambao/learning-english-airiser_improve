'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { getRepos } from '@/lib/repositories';

export interface DailyPlan {
  dueCount: number;
  freshCount: number;
  leechCount: number;
  totalWords: number;
}

const EMPTY: DailyPlan = { dueCount: 0, freshCount: 0, leechCount: 0, totalWords: 0 };

/** Backs Home's "what should I do today" summary — built entirely from existing
 * WordRepository methods (dueBefore/newNeverReviewed/leeches/countByStatus), the
 * same ones session-store.ts uses to build a session, so the numbers shown here can
 * never drift from what /practice actually serves. */
export function useDailyPlan(): DailyPlan {
  return (
    useLiveQuery(async () => {
      const now = Date.now();
      const repos = getRepos();
      const due = await repos.words.dueBefore(now, 50);
      const fresh = await repos.words.newNeverReviewed(50, due.map((w) => w.id));
      const leech = await repos.words.leeches(20);
      const byStatus = await repos.words.countByStatus();
      const totalWords = byStatus.new + byStatus.learning + byStatus.known;
      return { dueCount: due.length, freshCount: fresh.length, leechCount: leech.length, totalWords };
    }, []) ?? EMPTY
  );
}
