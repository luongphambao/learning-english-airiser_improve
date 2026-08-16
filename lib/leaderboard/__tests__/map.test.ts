import { describe, expect, it } from 'vitest';
import { entryFromDoc, toLeaderboardDoc } from '../map';
import { LeaderboardDocSchema } from '../types';
import type { LeaderboardEntry } from '../types';

const NOW = Date.UTC(2026, 5, 1, 12);
const DAY = 24 * 60 * 60 * 1000;

function entry(overrides: Partial<LeaderboardEntry> = {}): LeaderboardEntry {
  return {
    id: 'uid-x', name: 'X', initials: 'X', level: 'B1', isMe: false,
    words: 100, longestStreak: 10, totalReviews: 100, totalCorrect: 80,
    newLast7: 5, leechesConquered: 3, sampleWords: ['secret', 'notebook', 'words'],
    ...overrides,
  };
}

function rawDoc(overrides: Record<string, unknown> = {}) {
  return {
    uid: 'uid-x', name: 'X', level: 'B1', words: 100, longestStreak: 10,
    totalReviews: 100, totalCorrect: 80, newLast7: 5, leechesConquered: 3,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('lib/leaderboard/map toLeaderboardDoc', () => {
  it('never leaks sampleWords, initials, or isMe into the published doc', () => {
    const doc = toLeaderboardDoc(entry(), 'uid-x', NOW) as unknown as Record<string, unknown>;
    expect(doc).not.toHaveProperty('sampleWords');
    expect(doc).not.toHaveProperty('initials');
    expect(doc).not.toHaveProperty('isMe');
    expect(doc).not.toHaveProperty('email');
  });

  it('carries exactly the aggregate fields, stamped with the given uid and now', () => {
    const doc = toLeaderboardDoc(entry({ words: 42 }), 'uid-x', NOW);
    expect(doc).toEqual({
      uid: 'uid-x', name: 'X', level: 'B1', words: 42, longestStreak: 10,
      totalReviews: 100, totalCorrect: 80, newLast7: 5, leechesConquered: 3,
      updatedAt: NOW,
    });
  });
});

describe('lib/leaderboard/map LeaderboardDocSchema', () => {
  it('accepts a well-formed doc', () => {
    expect(LeaderboardDocSchema.safeParse(rawDoc()).success).toBe(true);
  });

  it('rejects a negative count', () => {
    expect(LeaderboardDocSchema.safeParse(rawDoc({ words: -1 })).success).toBe(false);
  });

  it('rejects an invalid level', () => {
    expect(LeaderboardDocSchema.safeParse(rawDoc({ level: 'Z9' })).success).toBe(false);
  });

  it('rejects a missing field', () => {
    const doc = rawDoc() as Record<string, unknown>;
    delete doc.updatedAt;
    expect(LeaderboardDocSchema.safeParse(doc).success).toBe(false);
  });

  it('rejects an empty or over-long name', () => {
    expect(LeaderboardDocSchema.safeParse(rawDoc({ name: '' })).success).toBe(false);
    expect(LeaderboardDocSchema.safeParse(rawDoc({ name: 'x'.repeat(41) })).success).toBe(false);
  });
});

describe('lib/leaderboard/map entryFromDoc', () => {
  it('returns null for a doc that fails to parse, rather than throwing', () => {
    expect(entryFromDoc(rawDoc({ words: -1 }), null, NOW)).toBeNull();
    expect(entryFromDoc({ garbage: true }, null, NOW)).toBeNull();
  });

  it('maps a valid doc, always with an empty sampleWords list', () => {
    const result = entryFromDoc(rawDoc(), null, NOW);
    expect(result?.sampleWords).toEqual([]);
    expect(result?.id).toBe('uid-x');
    expect(result?.initials).toBe('X');
  });

  it('sets isMe true iff the doc uid matches the viewer uid', () => {
    expect(entryFromDoc(rawDoc({ uid: 'uid-x' }), 'uid-x', NOW)?.isMe).toBe(true);
    expect(entryFromDoc(rawDoc({ uid: 'uid-x' }), 'uid-other', NOW)?.isMe).toBe(false);
    expect(entryFromDoc(rawDoc({ uid: 'uid-x' }), null, NOW)?.isMe).toBe(false);
  });

  it('keeps newLast7 as published when the doc is fresh', () => {
    const result = entryFromDoc(rawDoc({ newLast7: 5, updatedAt: NOW }), null, NOW);
    expect(result?.newLast7).toBe(5);
  });

  it('keeps newLast7 as published just under the 7-day staleness boundary', () => {
    const result = entryFromDoc(rawDoc({ newLast7: 5, updatedAt: NOW - (7 * DAY - 1) }), null, NOW);
    expect(result?.newLast7).toBe(5);
  });

  it('zeroes newLast7 once the doc has gone untouched for exactly 7 days', () => {
    const result = entryFromDoc(rawDoc({ newLast7: 5, updatedAt: NOW - 7 * DAY }), null, NOW);
    expect(result?.newLast7).toBe(0);
  });

  it('zeroes newLast7 for a long-abandoned doc, not just a frozen stale value', () => {
    const result = entryFromDoc(rawDoc({ newLast7: 30, updatedAt: NOW - 90 * DAY }), null, NOW);
    expect(result?.newLast7).toBe(0);
  });

  it('does not zero any of the other five metrics when the doc is stale', () => {
    const result = entryFromDoc(
      rawDoc({ words: 200, longestStreak: 50, totalReviews: 900, totalCorrect: 700, leechesConquered: 12, updatedAt: NOW - 30 * DAY }),
      null,
      NOW,
    );
    expect(result).toMatchObject({ words: 200, longestStreak: 50, totalReviews: 900, totalCorrect: 700, leechesConquered: 12 });
  });
});
