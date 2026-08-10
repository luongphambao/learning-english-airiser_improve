'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { getRepos } from '@/lib/repositories';
import type { GrammarAttempt } from '@/lib/domain';

/** Last attempt per topic, keyed by topicId — drives the "Lần trước: N/M" badge on
 * the grammar topic list (docs/decision.md ADR-011). */
export function useLastGrammarAttempts(): Record<string, GrammarAttempt> {
  return useLiveQuery(() => getRepos().grammar.lastAttemptByTopic(), []) ?? {};
}
