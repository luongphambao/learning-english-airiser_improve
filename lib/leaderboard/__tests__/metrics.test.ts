import { describe, expect, it } from 'vitest';
import {
  MIN_REVIEWS_FOR_ACCURACY,
  METRICS,
  buildLeaderboard,
  buildMyEntry,
  isConqueredHardWord,
  rankBy,
} from '../metrics';
import { MOCK_ROSTER } from '../mock';
import type { LeaderboardEntry } from '../types';
import type { UserSettings, UserStats, Word } from '@/lib/domain';

const NOW = Date.UTC(2026, 5, 1, 12); // 2026-06-01 noon UTC = 2026-06-01 19:00 ICT

function entry(overrides: Partial<LeaderboardEntry> = {}): LeaderboardEntry {
  return {
    id: 'x', name: 'X', initials: 'X', level: 'B1', isMe: false,
    words: 100, longestStreak: 10, totalReviews: 100, totalCorrect: 80,
    newLast7: 5, leechesConquered: 3, sampleWords: ['sample', 'words'],
    ...overrides,
  };
}

function stats(overrides: Partial<UserStats> = {}): UserStats {
  return {
    streak: 0, longestStreak: 0, lastStudiedOn: null, freezeUsedOn: null,
    totalReviews: 0, totalCorrect: 0, daysStudied: 0, history: {},
    ...overrides,
  };
}

function settings(overrides: Partial<UserSettings> = {}): UserSettings {
  return {
    reminderHour: null, studyTime: null, theme: 'system', locale: 'vi', contextTopic: '',
    level: 'B1', sessionSize: 5,
    levelProfile: { declared: null, placement: null, work: null, srs: null, updatedAt: null, lastPromptedAt: null },
    ...overrides,
  };
}

function word(overrides: Partial<Word> = {}): Word {
  return {
    id: 'w1', word: 'test', ipa: '', partOfSpeech: '', meaningVi: '',
    exampleSentence: '', distractors: [], collocations: [], wordFamily: [],
    source: { kind: 'manual', label: '', at: NOW },
    audioUrl: null, createdAt: NOW, dueAt: NOW,
    easeLevel: 0, reviewCount: 0, lapseCount: 0, isLeech: false,
    status: 'new',
    ...overrides,
  };
}

describe('lib/leaderboard/metrics rankBy', () => {
  it('sorts every entry descending by the selected metric', () => {
    const entries = [entry({ id: 'a', words: 10 }), entry({ id: 'b', words: 50 }), entry({ id: 'c', words: 30 })];
    const ranked = rankBy(entries, 'words');
    expect(ranked.map((r) => r.entry.id)).toEqual(['b', 'c', 'a']);
  });

  it('gives tied values the same rank and skips the next rank', () => {
    const entries = [
      entry({ id: 'a', words: 50 }),
      entry({ id: 'b', words: 50 }),
      entry({ id: 'c', words: 10 }),
    ];
    const ranked = rankBy(entries, 'words');
    expect(ranked.map((r) => r.rank)).toEqual([1, 1, 3]);
  });

  it('orders tied entries deterministically and identically across repeated calls', () => {
    const entries = [entry({ id: 'b', words: 50 }), entry({ id: 'a', words: 50 })];
    const first = rankBy(entries, 'words').map((r) => r.entry.id);
    const second = rankBy(entries, 'words').map((r) => r.entry.id);
    expect(first).toEqual(second);
  });

  it('never mutates the roster it is given', () => {
    const entries = [entry({ id: 'a', words: 10 }), entry({ id: 'b', words: 50 })];
    const before = entries.map((e) => e.id);
    rankBy(entries, 'words');
    expect(entries.map((e) => e.id)).toEqual(before);
  });

  it('accuracy ranking places learners under the minimum review threshold below every qualified learner', () => {
    const entries = [
      entry({ id: 'low-sample', totalReviews: 3, totalCorrect: 3 }), // 100% but unqualified
      entry({ id: 'qualified', totalReviews: MIN_REVIEWS_FOR_ACCURACY, totalCorrect: 10 }), // 50%
    ];
    const ranked = rankBy(entries, 'accuracy');
    expect(ranked.map((r) => r.entry.id)).toEqual(['qualified', 'low-sample']);
    expect(ranked[1].qualified).toBe(false);
  });

  it('every metric id in METRICS is rankable without throwing', () => {
    for (const m of METRICS) {
      expect(() => rankBy([entry()], m.id)).not.toThrow();
    }
  });
});

describe('lib/leaderboard/metrics buildMyEntry', () => {
  it('reports 0% accuracy, not NaN and not 100%, for a user with no reviews', () => {
    const me = buildMyEntry(stats(), settings(), [], NOW);
    expect(me.totalReviews).toBe(0);
    expect(me.totalCorrect).toBe(0);
  });

  it('counts words created in the last 7 Asia/Ho_Chi_Minh days including today', () => {
    const words = [
      word({ id: 'w1', createdAt: NOW }), // today
      word({ id: 'w2', createdAt: NOW - 6 * 86_400_000 }), // 6 days ago
      word({ id: 'w3', createdAt: NOW - 8 * 86_400_000 }), // 8 days ago — outside window
    ];
    const me = buildMyEntry(stats(), settings(), words, NOW);
    expect(me.newLast7).toBe(2);
  });

  it('counts a word created just after ICT midnight as today regardless of host timezone', () => {
    // 2026-05-25 17:30 UTC = 2026-05-26 00:30 ICT — exactly the 7th day back from
    // NOW's ICT calendar date (2026-06-01). A now-minus-7*86_400_000 ms window
    // would misclassify this depending on host TZ; the day-key-set approach must not.
    const boundaryWord = word({ id: 'w-boundary', createdAt: Date.UTC(2026, 4, 25, 17, 30) });
    const me = buildMyEntry(stats(), settings(), [boundaryWord], NOW);
    expect(me.newLast7).toBe(1);
  });

  it('counts a hard word as conquered only when it is known and no longer a leech', () => {
    const conquered = word({ id: 'w1', status: 'known', isLeech: false, lapseCount: 2 });
    const stillLeech = word({ id: 'w2', status: 'learning', isLeech: true, lapseCount: 4 });
    const neverLapsed = word({ id: 'w3', status: 'known', isLeech: false, lapseCount: 0 });
    const me = buildMyEntry(stats(), settings(), [conquered, stillLeech, neverLapsed], NOW);
    expect(me.leechesConquered).toBe(1);
  });

  it('does not count a still-active leech as conquered', () => {
    expect(isConqueredHardWord(word({ status: 'learning', isLeech: true, lapseCount: 4 }))).toBe(false);
  });

  it('samples real words most-recently-added first, capped at 12, never fabricated', () => {
    const words = [
      word({ id: 'w1', word: 'old', createdAt: NOW - 3 * 86_400_000 }),
      word({ id: 'w2', word: 'new', createdAt: NOW }),
      word({ id: 'w3', word: 'mid', createdAt: NOW - 86_400_000 }),
    ];
    const me = buildMyEntry(stats(), settings(), words, NOW);
    expect(me.sampleWords).toEqual(['new', 'mid', 'old']);
  });

  it('reports an empty sampleWords list, not a placeholder, for an empty notebook', () => {
    const me = buildMyEntry(stats(), settings(), [], NOW);
    expect(me.sampleWords).toEqual([]);
  });
});

describe('lib/leaderboard/metrics buildLeaderboard', () => {
  it('places a user with an empty notebook last on every metric', () => {
    const me = buildMyEntry(stats(), settings(), [], NOW);
    for (const m of METRICS) {
      const ranked = buildLeaderboard(me, m.id);
      const myRow = ranked.find((r) => r.entry.isMe);
      const lastRank = ranked[ranked.length - 1].rank;
      expect(myRow?.rank).toBe(lastRank);
    }
  });

  it('puts the current user on the board exactly once', () => {
    const me = buildMyEntry(stats({ totalReviews: 500, totalCorrect: 400, longestStreak: 30 }), settings(), [], NOW);
    const ranked = buildLeaderboard(me, 'words');
    expect(ranked.filter((r) => r.entry.isMe)).toHaveLength(1);
    expect(ranked).toHaveLength(MOCK_ROSTER.length + 1);
  });
});
