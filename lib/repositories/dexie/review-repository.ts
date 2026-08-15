import { getDb } from '@/lib/db/dexie';
import type { ReviewRepository } from '../types';

export function createDexieReviewRepository(): ReviewRepository {
  const db = getDb();

  return {
    async listByWord(wordId, limit) {
      const rows = await db.reviews
        .where('[wordId+answeredAt]')
        .between([wordId, Number.NEGATIVE_INFINITY], [wordId, Number.POSITIVE_INFINITY])
        .reverse()
        .limit(limit)
        .toArray();
      return rows;
    },

    async countByDayRange(fromDayKey, toDayKey) {
      const rows = await db.reviews
        .where('dayKey')
        .between(fromDayKey, toDayKey, true, true)
        .toArray();
      const counts: Record<string, number> = {};
      for (const row of rows) {
        counts[row.dayKey] = (counts[row.dayKey] ?? 0) + 1;
      }
      return counts;
    },

    async purgeOlderThan(dayKey) {
      const stale = await db.reviews.where('dayKey').below(dayKey).primaryKeys();
      await db.reviews.bulkDelete(stale);
      return stale.length;
    },

    async listRecent(limit) {
      return db.reviews.orderBy('answeredAt').reverse().limit(limit).toArray();
    },
  };
}
