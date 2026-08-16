import { getDb, type GrammarAttemptRow } from '@/lib/db/dexie';
import { newId } from '@/lib/db/ids';
import type { GrammarRepository } from '../types';

export function createDexieGrammarRepository(): GrammarRepository {
  const db = getDb();

  return {
    async recordAttempt(topicId, score, total, now) {
      const attempt: GrammarAttemptRow = { id: newId('ga_'), topicId, score, total, at: now, updatedAt: now };
      await db.grammarAttempts.put(attempt);
      return attempt;
    },

    async lastAttemptByTopic() {
      const rows = await db.grammarAttempts.orderBy('at').toArray();
      const byTopic: Record<string, GrammarAttemptRow> = {};
      // orderBy('at') ascending, so the last write per topicId wins — always the
      // most recent attempt without a second sort pass.
      for (const row of rows) byTopic[row.topicId] = row;
      return byTopic;
    },
  };
}
