// Single source of truth for "what day is it" across the whole SRS module — see
// docs/decision.md ADR-004 and docs/spec-gaps.md D3/D4. The old lib/srs.ts computed
// "today" in Asia/Ho_Chi_Minh but "yesterday" by decrementing a *local-timezone*
// `Date`, and parsed a "YYYY-MM-DD" string with `new Date(str)` (UTC midnight) in a
// third place — three different timezones inside one function. Every date here goes
// through the same Intl.DateTimeFormat and the same UTC-noon reconstruction, so a
// ±14h host timezone offset can never push a result across a day boundary.

export const APP_TZ = 'Asia/Ho_Chi_Minh';

const FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}); // en-CA formats as YYYY-MM-DD

export type DayKey = string;

/** The calendar date (Asia/Ho_Chi_Minh) a given epoch-ms timestamp falls on. */
export function dayKey(ts: number): DayKey {
  return FMT.format(new Date(ts));
}

const HOUR_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TZ,
  hour: 'numeric',
  hourCycle: 'h23',
});

/** The wall-clock hour (0..23, Asia/Ho_Chi_Minh) a given epoch-ms timestamp
 * falls on — what `UserSettings.reminderHour` is compared against by the
 * reminder cron (app/api/cron/send-reminders/route.ts). */
export function hourOfDay(ts: number): number {
  return Number(HOUR_FMT.format(new Date(ts)));
}

function parseDayKey(key: DayKey): { y: number; m: number; d: number } {
  const [y, m, d] = key.split('-').map(Number);
  return { y: y ?? 1970, m: m ?? 1, d: d ?? 1 };
}

/** UTC noon on the given day-key's date — never midnight, so it can't roll over to
 * the adjacent day under any real-world timezone offset when reformatted. */
function toUtcNoon(key: DayKey): number {
  const { y, m, d } = parseDayKey(key);
  return Date.UTC(y, m - 1, d, 12);
}

export function addDays(key: DayKey, n: number): DayKey {
  return FMT.format(new Date(toUtcNoon(key) + n * 86_400_000));
}

export function daysBetween(a: DayKey, b: DayKey): number {
  return Math.round((toUtcNoon(b) - toUtcNoon(a)) / 86_400_000);
}

export function lastNDays(key: DayKey, n: number): DayKey[] {
  const out: DayKey[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(key, -i));
  return out;
}

const WEEKDAYS_VI = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']; // Date#getUTCDay(): 0 = Sunday

export function weekdayVi(key: DayKey): string {
  const idx = new Date(toUtcNoon(key)).getUTCDay();
  return WEEKDAYS_VI[idx] ?? 'CN';
}
