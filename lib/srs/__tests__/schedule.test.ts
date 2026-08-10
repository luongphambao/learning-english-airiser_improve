import { describe, expect, it } from 'vitest';
import { applyTriage, INTERVALS_DAYS, LEECH_LAPSE_THRESHOLD, nextSchedule, type SrsState } from '../schedule';

const DAY_MS = 86_400_000;
const NOW = Date.UTC(2026, 0, 1, 12);

function state(overrides: Partial<SrsState> = {}): SrsState {
  return {
    easeLevel: 0,
    dueAt: NOW,
    reviewCount: 0,
    lapseCount: 0,
    consecutiveCorrect: 0,
    isLeech: false,
    status: 'new',
    ...overrides,
  };
}

describe('lib/srs/schedule nextSchedule', () => {
  it('a correct answer on a brand-new word schedules INTERVALS_DAYS[1], not [0]', () => {
    // spec-gaps.md D1: dueAt uses the ease level AFTER this answer.
    const result = nextSchedule(state(), true, NOW);
    expect(result.easeLevel).toBe(1);
    expect(result.dueAt).toBe(NOW + INTERVALS_DAYS[1] * DAY_MS);
    expect(result.dueAt).not.toBe(NOW + INTERVALS_DAYS[0] * DAY_MS);
  });

  it('climbs the ease ladder to 5 and clamps there', () => {
    let s = state();
    for (let i = 0; i < 10; i++) s = nextSchedule(s, true, NOW);
    expect(s.easeLevel).toBe(5);
    expect(s.dueAt).toBe(NOW + INTERVALS_DAYS[5] * DAY_MS);
  });

  it('a wrong answer drops ease level by 2, clamped at 0', () => {
    expect(nextSchedule(state({ easeLevel: 3 }), false, NOW).easeLevel).toBe(1);
    expect(nextSchedule(state({ easeLevel: 1 }), false, NOW).easeLevel).toBe(0);
    expect(nextSchedule(state({ easeLevel: 0 }), false, NOW).easeLevel).toBe(0);
  });

  it('status derives from ease level: 0 new, 1-3 learning, 4-5 known', () => {
    expect(nextSchedule(state({ easeLevel: 3 }), false, NOW).status).toBe('learning'); // -> 1
    expect(nextSchedule(state({ easeLevel: 4 }), true, NOW).status).toBe('known'); // -> 5
    expect(nextSchedule(state({ easeLevel: 1 }), false, NOW).status).toBe('new'); // -> 0
  });

  it('becomes a leech exactly when lapseCount reaches the threshold', () => {
    let s = state();
    for (let i = 1; i < LEECH_LAPSE_THRESHOLD; i++) {
      s = nextSchedule(s, false, NOW);
      expect(s.isLeech).toBe(false);
    }
    s = nextSchedule(s, false, NOW);
    expect(s.lapseCount).toBe(LEECH_LAPSE_THRESHOLD);
    expect(s.isLeech).toBe(true);
  });

  it('a leech clears after exactly 2 consecutive correct answers, with lapseCount reset to 2', () => {
    const leech = state({ isLeech: true, lapseCount: 5, consecutiveCorrect: 0 });
    const afterOne = nextSchedule(leech, true, NOW);
    expect(afterOne.isLeech).toBe(true); // one correct answer is not enough
    expect(afterOne.consecutiveCorrect).toBe(1);

    const afterTwo = nextSchedule(afterOne, true, NOW);
    expect(afterTwo.isLeech).toBe(false);
    expect(afterTwo.lapseCount).toBe(2);
  });

  it('a wrong answer between two corrects resets the leech-clearing streak', () => {
    const leech = state({ isLeech: true, lapseCount: 5, consecutiveCorrect: 0 });
    const afterCorrect = nextSchedule(leech, true, NOW);
    const afterWrong = nextSchedule(afterCorrect, false, NOW);
    expect(afterWrong.isLeech).toBe(true);
    expect(afterWrong.consecutiveCorrect).toBe(0);
  });
});

describe('lib/srs/schedule applyTriage', () => {
  it('known -> null (caller writes to the skipped list instead)', () => {
    expect(applyTriage('known', NOW)).toBeNull();
  });

  it('partial -> easeLevel 2, due in exactly 3 days (not INTERVALS_DAYS[2]=7)', () => {
    const s = applyTriage('partial', NOW)!;
    expect(s.easeLevel).toBe(2);
    expect(s.dueAt).toBe(NOW + 3 * DAY_MS);
    expect(s.status).toBe('learning');
    expect(s.reviewCount).toBe(0);
  });

  it('unknown -> easeLevel 0, due now, status new', () => {
    const s = applyTriage('unknown', NOW)!;
    expect(s.easeLevel).toBe(0);
    expect(s.dueAt).toBe(NOW);
    expect(s.status).toBe('new');
  });
});
