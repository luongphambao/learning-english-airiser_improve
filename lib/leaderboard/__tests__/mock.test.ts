import { describe, expect, it } from 'vitest';
import { MOCK_ROSTER, initialsFromName } from '../mock';
import { METRICS, accuracyPct } from '../metrics';

describe('lib/leaderboard/mock MOCK_ROSTER', () => {
  it('has unique ids and unique names', () => {
    const ids = MOCK_ROSTER.map((e) => e.id);
    const names = MOCK_ROSTER.map((e) => e.name);
    expect(new Set(ids).size).toBe(MOCK_ROSTER.length);
    expect(new Set(names).size).toBe(MOCK_ROSTER.length);
  });

  it("every mock learner's review count is plausible for their vocabulary size", () => {
    for (const e of MOCK_ROSTER) {
      expect(e.totalReviews).toBeGreaterThanOrEqual(e.words * 2);
      expect(e.totalReviews).toBeLessThanOrEqual(e.words * 10);
    }
  });

  it('no mock learner has more correct answers than reviews, or an implausible accuracy', () => {
    for (const e of MOCK_ROSTER) {
      expect(e.totalCorrect).toBeLessThanOrEqual(e.totalReviews);
      const acc = accuracyPct(e);
      expect(acc).toBeGreaterThanOrEqual(60);
      expect(acc).toBeLessThanOrEqual(95);
    }
  });

  it("no mock learner's longest streak exceeds what their review count could support", () => {
    for (const e of MOCK_ROSTER) {
      expect(e.longestStreak * 2).toBeLessThanOrEqual(e.totalReviews);
    }
  });

  it("no mock learner's newLast7 or leechesConquered exceeds their vocabulary size", () => {
    for (const e of MOCK_ROSTER) {
      expect(e.newLast7).toBeLessThanOrEqual(Math.min(e.words, 30));
      expect(e.leechesConquered).toBeLessThanOrEqual(Math.floor(e.words * 0.15));
    }
  });

  it('at least five of the six metrics have a different top-ranked mock learner', () => {
    const leaders = new Set(
      METRICS.map((m) => {
        const top = [...MOCK_ROSTER].sort((a, b) => m.valueOf(b) - m.valueOf(a))[0];
        return top.id;
      }),
    );
    expect(leaders.size).toBeGreaterThanOrEqual(5);
  });

  it('every mock learner has a non-empty, deduplicated sample word list', () => {
    for (const e of MOCK_ROSTER) {
      expect(e.sampleWords.length).toBeGreaterThan(0);
      expect(e.sampleWords.length).toBeLessThanOrEqual(16);
      expect(new Set(e.sampleWords).size).toBe(e.sampleWords.length);
    }
  });

  it('contains at least one genuine tie on words and one on longestStreak, so competition ranking is exercised by real data', () => {
    const hasTie = (values: number[]) => new Set(values).size < values.length;
    expect(hasTie(MOCK_ROSTER.map((e) => e.words))).toBe(true);
    expect(hasTie(MOCK_ROSTER.map((e) => e.longestStreak))).toBe(true);
  });
});

describe('lib/leaderboard/mock initialsFromName', () => {
  it('derives the monogram from the last two syllables of a Vietnamese given-name-last name', () => {
    expect(initialsFromName('Lê Thị Hồng Vân')).toBe('HV');
    expect(initialsFromName('Nguyễn Minh Anh')).toBe('MA');
  });

  it('matches the literal initials shipped on the roster', () => {
    for (const e of MOCK_ROSTER) {
      expect(initialsFromName(e.name)).toBe(e.initials);
    }
  });
});
