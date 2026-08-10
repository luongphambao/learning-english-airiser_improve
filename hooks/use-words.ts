'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { getRepos } from '@/lib/repositories';
import type { Word, WordStatus } from '@/lib/domain';

export interface UseWordsQuery {
  status?: WordStatus;
  search?: string;
  limit?: number;
}

/** Reactive word list — re-renders automatically whenever the `words` Dexie table
 * changes (add/patch/delete), with no manual setState. This is what makes bug #1
 * (stale-closure enrichment never showing up) impossible to reintroduce: nothing
 * subscribes to a snapshot array, everything subscribes to the table itself. */
export function useWordsList(query: UseWordsQuery = {}): Word[] {
  const { status, search, limit = 500 } = query;
  return (
    useLiveQuery(
      () => getRepos().words.list({ status, search, limit }),
      [status, search, limit],
    ) ?? []
  );
}

export function useWord(id: string | null | undefined) {
  return useLiveQuery(() => (id ? getRepos().words.get(id) : null), [id]);
}
