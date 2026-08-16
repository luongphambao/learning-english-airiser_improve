import { dayKey, lastNDays } from '@/lib/srs/date';
import { LEECH_RESET_LAPSE } from '@/lib/srs/schedule';
import type { UserSettings, UserStats, Word } from '@/lib/domain';
import { initialsFromName } from './name';
import type { LeaderboardEntry, LeaderboardMetricId, MetricConfig, RankedEntry } from './types';

// Accuracy on a handful of reviews is noise, not skill: 3/3 = 100% would outrank
// someone at 2800/3180. Below this, an entry is unranked on the accuracy metric —
// sorted below every qualified entry and rendered "—" — rather than flattered or
// punished by a tiny sample.
export const MIN_REVIEWS_FOR_ACCURACY = 20;

export const accuracyPct = (entry: LeaderboardEntry): number =>
  entry.totalReviews > 0 ? (entry.totalCorrect / entry.totalReviews) * 100 : 0;

// `Word.isLeech` is a live boolean with no history, so "used to be a leech" isn't
// directly recoverable. lib/srs/schedule.ts's leech-clear path is the one anchor we
// have: clearing a leech sets `isLeech = false` AND `lapseCount = LEECH_RESET_LAPSE`
// (a cleared leech is left fragile, not reset to a clean slate). So "known, not a
// leech, carries the lapse scar" is the best available signal for "conquered".
// Deliberate over-count: a word that lapsed twice without ever reaching
// LEECH_LAPSE_THRESHOLD also matches this — accepted rather than adding a persisted
// `wasLeech` field (and a Dexie migration) for a demo leaderboard screen.
export const isConqueredHardWord = (word: Word): boolean =>
  word.status === 'known' && word.isLeech === false && word.lapseCount >= LEECH_RESET_LAPSE;

export const METRICS: readonly MetricConfig[] = [
  {
    id: 'words',
    labelKey: 'leaderboardPage.metricWords',
    hintKey: 'leaderboardPage.metricWordsHint',
    valueOf: (e) => e.words,
    format: (e, t) => t('leaderboardPage.unitWords', { count: e.words }),
  },
  {
    id: 'longestStreak',
    labelKey: 'leaderboardPage.metricLongestStreak',
    hintKey: 'leaderboardPage.metricLongestStreakHint',
    valueOf: (e) => e.longestStreak,
    format: (e, t) => t('leaderboardPage.unitDays', { count: e.longestStreak }),
  },
  {
    id: 'totalReviews',
    labelKey: 'leaderboardPage.metricTotalReviews',
    hintKey: 'leaderboardPage.metricTotalReviewsHint',
    valueOf: (e) => e.totalReviews,
    format: (e, t) => t('leaderboardPage.unitReviews', { count: e.totalReviews }),
  },
  {
    id: 'accuracy',
    labelKey: 'leaderboardPage.metricAccuracy',
    // MIN_REVIEWS_FOR_ACCURACY (20) is baked as a literal into both dictionary
    // strings rather than passed as a t() var — it's a compile-time constant, not
    // runtime data, so a static translated sentence is simpler than plumbing vars
    // through this non-component config object.
    hintKey: 'leaderboardPage.metricAccuracyHint',
    valueOf: accuracyPct,
    qualifies: (e) => e.totalReviews >= MIN_REVIEWS_FOR_ACCURACY,
    // No unit to localize — a percentage sign reads the same in both languages.
    format: (e) => `${accuracyPct(e).toFixed(1)}%`,
  },
  {
    id: 'newLast7',
    labelKey: 'leaderboardPage.metricNewLast7',
    hintKey: 'leaderboardPage.metricNewLast7Hint',
    valueOf: (e) => e.newLast7,
    format: (e, t) => t('leaderboardPage.unitWords', { count: e.newLast7 }),
  },
  {
    id: 'leechesConquered',
    labelKey: 'leaderboardPage.metricLeechesConquered',
    hintKey: 'leaderboardPage.metricLeechesConqueredHint',
    valueOf: (e) => e.leechesConquered,
    format: (e, t) => t('leaderboardPage.unitWords', { count: e.leechesConquered }),
  },
] as const;

export const getMetric = (id: LeaderboardMetricId): MetricConfig =>
  METRICS.find((m) => m.id === id) ?? METRICS[0];

/** Identity the current user's row is published/displayed under.
 * `uid` is null when signed out — the row then exists only locally, keyed 'me',
 * and is never published (lib/leaderboard/publish.ts checks for a signed-in uid
 * itself before calling this at all, but `buildMyEntry` stays safe to call either
 * way since /leaderboard also renders a signed-out user's own local row). `name`
 * is the already-resolved display name (lib/leaderboard/name.ts's
 * resolveDisplayName fallback chain) — this function does no name resolution of
 * its own so it stays free of i18n/Firebase concerns. */
export interface MyIdentity {
  uid: string | null;
  name: string;
}

/** Pure — caller owns the clock (docs/decision.md ADR-004), like every lib/srs/**
 * function. `words` should be fetched with a high limit by the caller (the default
 * useWordsList limit of 500 would silently undercount a very large notebook here,
 * unlike /progress where only a bounded list is ever rendered). */
export function buildMyEntry(
  stats: UserStats,
  settings: UserSettings,
  words: readonly Word[],
  now: number,
  identity: MyIdentity,
): LeaderboardEntry {
  // A day-key set, not a `now - 7 * 86_400_000` millisecond window: the rest of the
  // app defines "a day" as an Asia/Ho_Chi_Minh calendar date (lib/srs/date.ts), and
  // a ms-window would misclassify a word added late at night some days ago.
  const window = new Set(lastNDays(dayKey(now), 7));
  // Most-recently-added first, capped — a representative taste of the notebook,
  // not the whole thing. Shown ONLY on the current user's own row (never
  // published to Firestore, ADR-025) — every other entry gets [].
  const sampleWords = [...words]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 12)
    .map((w) => w.word);
  return {
    id: identity.uid ?? 'me',
    name: identity.name,
    initials: initialsFromName(identity.name),
    level: settings.level,
    isMe: true,
    words: words.length,
    longestStreak: stats.longestStreak,
    totalReviews: stats.totalReviews,
    totalCorrect: stats.totalCorrect,
    newLast7: words.filter((w) => window.has(dayKey(w.createdAt))).length,
    leechesConquered: words.filter(isConqueredHardWord).length,
    sampleWords,
  };
}

/**
 * Competition ranking (1, 2, 2, 4): tied values share a rank and the next rank
 * skips, so "#7 trên 21" stays arithmetically true. Row order past the ranked
 * value is total and metric-independent (totalReviews desc, then words desc, then
 * id asc) so two people tied on one metric always appear in the same relative
 * order, on every metric, on every render — switching chips never reshuffles ties
 * arbitrarily. Never sorts `entries` in place (MOCK_ROSTER is module-level state).
 */
export function rankBy(
  entries: readonly LeaderboardEntry[],
  metricId: LeaderboardMetricId,
): RankedEntry[] {
  const metric = getMetric(metricId);
  const scored = entries.map((entry) => ({
    entry,
    value: metric.valueOf(entry),
    qualified: metric.qualifies ? metric.qualifies(entry) : true,
    rank: 0,
  }));

  scored.sort((a, b) => {
    if (a.qualified !== b.qualified) return a.qualified ? -1 : 1;
    if (b.value !== a.value) return b.value - a.value;
    if (b.entry.totalReviews !== a.entry.totalReviews) return b.entry.totalReviews - a.entry.totalReviews;
    if (b.entry.words !== a.entry.words) return b.entry.words - a.entry.words;
    return a.entry.id.localeCompare(b.entry.id);
  });

  let lastValue = Number.NaN;
  let lastQualified = true;
  let lastRank = 0;
  scored.forEach((row, i) => {
    const same = row.qualified === lastQualified && row.value === lastValue;
    row.rank = same ? lastRank : i + 1;
    lastRank = row.rank;
    lastValue = row.value;
    lastQualified = row.qualified;
  });

  return scored;
}

/**
 * `others` comes from Firestore (lib/leaderboard/remote.ts's fetchRecentDocs(),
 * mapped through entryFromDoc()) — real people, not a mock roster (ADR-025). `me`
 * is excluded from `others` by id before ranking: the current user's own
 * Firestore doc (if any) is always at least one publish-round stale compared to
 * the just-computed `me`, so it must never be allowed to shadow it.
 */
export function buildLeaderboard(
  me: LeaderboardEntry,
  others: readonly LeaderboardEntry[],
  metricId: LeaderboardMetricId,
): RankedEntry[] {
  const rest = others.filter((e) => e.id !== me.id);
  return rankBy([...rest, me], metricId);
}
