import { getDb, USER_ID } from '@/lib/db/dexie';
import { newId } from '@/lib/db/ids';
import { fromRow, toRow } from '@/lib/db/rows';
import { nextSchedule } from '@/lib/srs/schedule';
import { nextStats } from '@/lib/srs/streak';
import { dayKey } from '@/lib/srs/date';
import type { Word } from '@/lib/domain';
import type { RecordReviewInput, RecordReviewResult, StudyRepository } from '../types';
import { DEFAULT_SETTINGS, DEFAULT_STATS } from './user-repository';

/**
 * docs/decision.md ADR-005 — the unit of work. Word + Review + UserStats move
 * together inside one Dexie transaction, all read fresh from the DB (never from a
 * caller-supplied snapshot — that's precisely the stale-closure shape that broke
 * enrichment in the old WordsContext, audit #9). All three commit or none do.
 */
export function createDexieStudyRepository(): StudyRepository {
  const db = getDb();

  return {
    async recordReview(input: RecordReviewInput): Promise<RecordReviewResult> {
      return db.transaction('rw', db.words, db.reviews, db.user, async () => {
        const row = await db.words.get(input.wordId);
        if (!row) throw new Error(`word_not_found:${input.wordId}`);
        const word = fromRow(row);

        const scheduled = nextSchedule(
          {
            easeLevel: word.easeLevel,
            dueAt: word.dueAt,
            reviewCount: word.reviewCount,
            lapseCount: word.lapseCount,
            consecutiveCorrect: word.consecutiveCorrect ?? 0,
            isLeech: word.isLeech,
            status: word.status,
          },
          input.correct,
          input.now,
        );

        const updatedWord: Word = { ...word, ...scheduled, updatedAt: input.now };
        await db.words.put(toRow(updatedWord, input.now));

        const review = {
          id: newId('r_'),
          wordId: word.id,
          kind: input.kind,
          correct: input.correct,
          answeredAt: input.now,
          sessionId: input.sessionId,
          dayKey: dayKey(input.now),
          updatedAt: input.now,
        };
        await db.reviews.add(review);

        const userRow = (await db.user.get(USER_ID)) ?? {
          id: USER_ID,
          settings: DEFAULT_SETTINGS,
          stats: DEFAULT_STATS,
          updatedAt: input.now,
        };
        const stats = nextStats(userRow.stats, input.correct, input.now);
        await db.user.put({ ...userRow, stats, updatedAt: input.now });

        return { word: updatedWord, stats, review };
      });
    },

    async saveSession(session) {
      await db.studySessions.put(session);
    },

    async loadActiveSession(dayKey) {
      const rows = await db.studySessions.where('dayKey').equals(dayKey).toArray();
      return rows.find((s) => s.status === 'active') ?? null;
    },
  };
}
