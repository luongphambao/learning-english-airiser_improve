'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { getRepos } from '@/lib/repositories';

/** Reactive single Import row — drives the /tai-tai-lieu screen so it always shows
 * the live triage state, including from a background enrich/analyze update. */
export function useImport(id: string | null | undefined) {
  return useLiveQuery(() => (id ? getRepos().imports.get(id) : null), [id]);
}

export function useImportsList(limit = 20) {
  return useLiveQuery(() => getRepos().imports.list(limit), [limit]) ?? [];
}
