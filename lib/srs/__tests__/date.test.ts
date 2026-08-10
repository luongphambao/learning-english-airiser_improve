import { describe, expect, it } from 'vitest';
import { addDays, dayKey, daysBetween, lastNDays, weekdayVi } from '../date';

// Runs under both TZ=UTC and TZ=America/New_York (vitest.config.ts) — every
// assertion here must hold regardless of the host machine's local timezone, which
// is exactly what the old lib/srs.ts got wrong (getYesterdayDateString built a
// *local*-timezone Date while getTodayDateString used Asia/Ho_Chi_Minh).
describe('lib/srs/date', () => {
  it('dayKey resolves to Asia/Ho_Chi_Minh regardless of host TZ', () => {
    // 2026-01-15 23:30 ICT (UTC+7) = 2026-01-15 16:30 UTC
    const late = Date.UTC(2026, 0, 15, 16, 30);
    expect(dayKey(late)).toBe('2026-01-15');

    // 2026-01-16 00:30 ICT = 2026-01-15 17:30 UTC — just past midnight in Vietnam
    const justAfterMidnight = Date.UTC(2026, 0, 15, 17, 30);
    expect(dayKey(justAfterMidnight)).toBe('2026-01-16');
  });

  it('addDays crosses month and year boundaries correctly', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('daysBetween matches addDays inverse', () => {
    expect(daysBetween('2026-01-01', '2026-01-02')).toBe(1);
    expect(daysBetween('2026-01-01', '2026-01-08')).toBe(7);
    expect(daysBetween('2026-01-08', '2026-01-01')).toBe(-7);
    expect(daysBetween('2026-01-01', '2026-01-01')).toBe(0);
  });

  it('lastNDays returns N consecutive keys ending at the given key', () => {
    const days = lastNDays('2026-01-07', 7);
    expect(days).toEqual([
      '2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04',
      '2026-01-05', '2026-01-06', '2026-01-07',
    ]);
  });

  it('weekdayVi is stable regardless of host TZ', () => {
    // 2026-01-05 is a Monday
    expect(weekdayVi('2026-01-05')).toBe('T2');
    expect(weekdayVi('2026-01-11')).toBe('CN'); // Sunday
  });
});
