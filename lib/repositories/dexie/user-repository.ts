import { getDb, USER_ID } from '@/lib/db/dexie';
import { UserSettingsSchema, type UserSettings, type UserStats } from '@/lib/domain';
import { safeParseRow } from '@/lib/db/read';
import type { UserRepository } from '../types';

export const DEFAULT_SETTINGS: UserSettings = {
  reminderHour: null,
  studyTime: null,
  theme: 'system',
  contextTopic: 'software engineering',
  level: 'B2',
  sessionSize: 5,
  levelProfile: {
    declared: null,
    placement: null,
    work: null,
    srs: null,
    updatedAt: null,
    lastPromptedAt: null,
  },
};

export const DEFAULT_STATS: UserStats = {
  streak: 0,
  longestStreak: 0,
  lastStudiedOn: null,
  freezeUsedOn: null,
  totalReviews: 0,
  totalCorrect: 0,
  daysStudied: 0,
  history: {},
};

async function ensureUserRow() {
  const db = getDb();
  const existing = await db.user.get(USER_ID);
  if (existing) return existing;
  const row = { id: USER_ID, settings: DEFAULT_SETTINGS, stats: DEFAULT_STATS, updatedAt: Date.now() };
  await db.user.add(row);
  return row;
}

export function createDexieUserRepository(): UserRepository {
  const db = getDb();

  return {
    // Pure read — no `ensureUserRow()` here. getProfile() is called from
    // useLiveQuery (hooks/use-profile.ts), and Dexie's liveQuery querier runs in a
    // read-only transaction: writing inside it (the old ensureUserRow() call did)
    // throws `ReadOnlyError` the moment the `user` row doesn't exist yet — e.g. if
    // Providers' migrate/seed step ever fails or races. Missing row -> return
    // defaults instead of creating one; the row gets created for real the first
    // time updateSettings() runs, inside a proper read-write transaction.
    async getProfile() {
      const row = await db.user.get(USER_ID);
      if (!row) return { settings: DEFAULT_SETTINGS, stats: DEFAULT_STATS };

      // A row written before v4 by a still-open tab can be missing
      // levelProfile/sessionSize at runtime while TypeScript believes they're
      // present (the v4 upgrade() merge is the durable fix; this is the belt to its
      // suspenders). safeParse, never parse — this runs inside useLiveQuery's
      // read-only transaction, where a throw blanks the screen instead of erroring
      // loudly somewhere visible.
      const parsed = safeParseRow(UserSettingsSchema, { ...DEFAULT_SETTINGS, ...row.settings });
      const settings = parsed.ok ? parsed.value : DEFAULT_SETTINGS;
      return { settings, stats: row.stats };
    },

    async updateSettings(patch) {
      return db.transaction('rw', db.user, async () => {
        const row = await ensureUserRow();
        const settings = { ...row.settings, ...patch };
        await db.user.update(USER_ID, { settings, updatedAt: Date.now() });
        return settings;
      });
    },
  };
}
