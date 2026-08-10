import { describe, expect, it } from 'vitest';
import { nextStats } from '../streak';
import { dayKey, addDays } from '../date';
import type { UserStats } from '@/lib/domain';

const DAY_MS = 86_400_000;
const D0 = Date.UTC(2026, 5, 10, 12); // 2026-06-10 noon UTC
const D1 = D0 + DAY_MS;
const D2 = D0 + 2 * DAY_MS;
const D3 = D0 + 3 * DAY_MS;

function stats(overrides: Partial<UserStats> = {}): UserStats {
  return {
    streak: 0,
    longestStreak: 0,
    lastStudiedOn: null,
    freezeUsedOn: null,
    totalReviews: 0,
    totalCorrect: 0,
    daysStudied: 0,
    history: {},
    ...overrides,
  };
}

describe('lib/srs/streak nextStats', () => {
  it('first ever review sets streak to 1', () => {
    const s = nextStats(stats(), true, D0);
    expect(s.streak).toBe(1);
    expect(s.lastStudiedOn).toBe(dayKey(D0));
    expect(s.daysStudied).toBe(1);
  });

  it('a second review the same day does not change streak or daysStudied', () => {
    const after1 = nextStats(stats(), true, D0);
    const after2 = nextStats(after1, false, D0 + 60_000);
    expect(after2.streak).toBe(1);
    expect(after2.daysStudied).toBe(1);
    expect(after2.totalReviews).toBe(2);
    expect(after2.totalCorrect).toBe(1);
  });

  it('reviewing on the very next day increments the streak', () => {
    const after1 = nextStats(stats(), true, D0);
    const after2 = nextStats(after1, true, D1);
    expect(after2.streak).toBe(2);
    expect(after2.longestStreak).toBe(2);
  });

  it('missing exactly one day silently spends a freeze and keeps the streak alive', () => {
    const after1 = nextStats(stats(), true, D0);
    const after2 = nextStats(after1, true, D2); // skipped D1
    expect(after2.streak).toBe(2);
    expect(after2.freezeUsedOn).toBe(dayKey(D1)); // the missed day, recorded silently
  });

  it('missing two or more days resets the streak to 1', () => {
    const after1 = nextStats(stats(), true, D0);
    const after2 = nextStats(after1, true, D3); // skipped D1 and D2
    expect(after2.streak).toBe(1);
  });

  it('a second freeze within 7 days of the first does not save the streak', () => {
    // Day 0: study. Day 2: miss day 1, freeze spent on day 1.
    let s = nextStats(stats(), true, D0);
    s = nextStats(s, true, D2);
    expect(s.freezeUsedOn).toBe(dayKey(D1));

    // Day 4: miss day 3 too — freeze from day 1 is only 3 days old, still inside the
    // 7-day cooldown, so this time the streak resets.
    const D4 = D0 + 4 * DAY_MS;
    s = nextStats(s, true, D4);
    expect(s.streak).toBe(1);
  });

  it('a freeze more than 7 days old can be used again', () => {
    const lastStudied = dayKey(D0);
    const oldFreeze = addDays(lastStudied, -20); // well outside the 7-day cooldown
    const s = stats({ streak: 5, longestStreak: 5, lastStudiedOn: lastStudied, freezeUsedOn: oldFreeze });

    const after = nextStats(s, true, D2); // skip D1, review again on D2
    expect(after.streak).toBe(6);
    expect(after.freezeUsedOn).toBe(dayKey(D1)); // a fresh freeze spent on the newly missed day
  });

  it('longestStreak only ever grows', () => {
    const s = nextStats(stats({ longestStreak: 10, streak: 1 }), true, D0);
    expect(s.longestStreak).toBe(10);
  });

  it('history is keyed by dayKey and prunes beyond 90 entries', () => {
    let s = stats();
    let t = D0;
    for (let i = 0; i < 95; i++) {
      s = nextStats(s, true, t);
      t += DAY_MS;
    }
    expect(Object.keys(s.history).length).toBeLessThanOrEqual(90);
  });
});
