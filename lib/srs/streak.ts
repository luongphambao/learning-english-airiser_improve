import type { UserStats } from '@/lib/domain';
import { addDays, dayKey, daysBetween } from './date';

const HISTORY_RETENTION_DAYS = 90;

/**
 * spec §8.1 streak rules, with the ambiguities in docs/spec-gaps.md §D resolved to
 * concrete day counts:
 * - same day again -> no change
 * - exactly 1 day since last studied -> streak += 1
 * - exactly 2 days since last studied (one day missed) AND no freeze used in the
 *   last 7 days -> streak += 1, silently spend the freeze on the missed day
 * - anything else -> streak resets to 1
 * "A day qualifies if the user reviews at least ONE word" — this function is called
 * once per review, so day-boundary logic only fires the first time `today` differs
 * from `lastStudiedOn`; later reviews the same day just bump the counters.
 */
export function nextStats(stats: UserStats, correct: boolean, now: number): UserStats {
  const today = dayKey(now);

  let { streak, longestStreak, lastStudiedOn, freezeUsedOn, daysStudied } = stats;
  const totalReviews = stats.totalReviews + 1;
  const totalCorrect = stats.totalCorrect + (correct ? 1 : 0);

  const isFirstReviewToday = lastStudiedOn !== today;
  if (isFirstReviewToday) {
    if (lastStudiedOn === null) {
      streak = 1;
    } else {
      const gap = daysBetween(lastStudiedOn, today);
      if (gap === 1) {
        streak += 1;
      } else if (gap === 2 && (freezeUsedOn === null || daysBetween(freezeUsedOn, today) > 7)) {
        streak += 1;
        freezeUsedOn = addDays(today, -1); // the missed day — never surfaced to the user
      } else {
        streak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, streak);
    daysStudied += 1;
    lastStudiedOn = today;
  }

  const history: Record<string, number> = { ...stats.history, [today]: (stats.history[today] ?? 0) + 1 };
  const keys = Object.keys(history).sort();
  if (keys.length > HISTORY_RETENTION_DAYS) {
    for (const staleKey of keys.slice(0, keys.length - HISTORY_RETENTION_DAYS)) {
      delete history[staleKey];
    }
  }

  return { streak, longestStreak, lastStudiedOn, freezeUsedOn, totalReviews, totalCorrect, daysStudied, history };
}
