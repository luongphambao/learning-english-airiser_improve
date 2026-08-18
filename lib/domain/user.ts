import { z } from 'zod';
import { CefrSchema } from './word';

// UI display language — separate from `Cefr` (the English *content* level being
// learned). 'vi' is the app's original, complete language; 'en' is the toggle
// added alongside it (lib/i18n/**) — see docs/decision.md ADR-024.
export const LocaleSchema = z.enum(['vi', 'en']);
export type Locale = z.infer<typeof LocaleSchema>;

export const UserStatsSchema = z.object({
  streak: z.number(),
  longestStreak: z.number(),
  lastStudiedOn: z.string().nullable(), // "YYYY-MM-DD" in Asia/Ho_Chi_Minh
  freezeUsedOn: z.string().nullable(),
  totalReviews: z.number(),
  totalCorrect: z.number(),
  daysStudied: z.number(),
  history: z.record(z.string(), z.number()), // dayKey -> review count
});
export type UserStats = z.infer<typeof UserStatsSchema>;

// docs/decision.md ADR-017 — one evidence record per level signal. `weight` is the
// signal's evidence strength (not a probability), consumed by lib/level/resolve.ts's
// weighted-median combination; `at` lets a signal be treated as stale (e.g. a
// placement result older than 90 days counts for less).
export const LevelSignalSchema = z.object({
  level: CefrSchema,
  weight: z.number(),
  at: z.number(),
});
export type LevelSignal = z.infer<typeof LevelSignalSchema>;

// docs/decision.md ADR-017 — the evidence store behind `UserSettings.level`. `level`
// itself stays the single value every existing call site reads (AI prompts, the
// settings dropdown); `levelProfile` only records WHY it is what it is, recomputed by
// lib/level/resolve.ts every time a new signal comes in. `declared` is intentionally
// separate from `level`: a non-null `declared` pins `level` and stops every automatic
// signal from moving it (lib/level/resolve.ts R1).
export const LevelProfileSchema = z.object({
  declared: CefrSchema.nullable().default(null),
  placement: LevelSignalSchema.nullable().default(null),
  work: LevelSignalSchema.nullable().default(null),
  srs: LevelSignalSchema.nullable().default(null),
  updatedAt: z.number().nullable().default(null),
  lastPromptedAt: z.number().nullable().default(null),
});
export type LevelProfile = z.infer<typeof LevelProfileSchema>;

// docs/decision.md ADR-028 — what the learner is studying FOR, as opposed to
// `contextTopic` (the domain they work in) and `level` (the CEFR band they read at).
// `text` is the only part that reaches an AI prompt; `kind` exists so the picker can
// re-highlight the chip that was tapped. `setAt` is the "already asked" flag —
// non-null after the onboarding screen is answered OR skipped, so skipping means
// "stop asking", not "ask again every load".
export const GoalKindSchema = z.enum(['ielts', 'toeic', 'communication', 'work', 'academic', 'custom']);
export type GoalKind = z.infer<typeof GoalKindSchema>;

export const LearningGoalSchema = z.object({
  kind: GoalKindSchema.default('custom'),
  // Deliberately NO `.max()` — same reason as `leaderboardName` below. The 120-char
  // cap is enforced non-destructively at the input's `maxLength` and by a slice
  // before the text is sent to an AI task.
  text: z.string().default(''),
  setAt: z.number().nullable().default(null),
});
export type LearningGoal = z.infer<typeof LearningGoalSchema>;

/** Mirrors `GoalField`'s `.max(120)` in lib/ai/tasks/contracts.ts. */
export const GOAL_MAX_LENGTH = 120;

/**
 * The one way a stored goal becomes an AI task input. The cap is enforced HERE
 * rather than left to each call site because `GoalField` uses `.max(120)`, which
 * *rejects* rather than truncates, and ai-client.ts validates input client-side
 * before the fetch — so one over-long goal would make every AI feature in the app
 * throw locally. That is the same failure shape ADR-017's CEFR widening caused, and
 * this is the fix applied up front instead of after.
 */
export function goalForPrompt(goal: LearningGoal): string {
  return goal.text.trim().slice(0, GOAL_MAX_LENGTH);
}

export const UserSettingsSchema = z.object({
  reminderHour: z.number().nullable(),
  studyTime: z.string().nullable(),
  theme: z.enum(['light', 'dark', 'system']),
  // Default 'vi' matches every pre-existing settings row (additive field, same
  // pattern as `sessionSize`/`levelProfile` below — no Dexie migration needed).
  locale: LocaleSchema.default('vi'),
  contextTopic: z.string(),
  // Widened from 'B1'|'B2'|'C1' to the full CEFR range (docs/decision.md ADR-017) —
  // existing stored values stay valid, this is additive. See lib/ai/tasks/contracts.ts
  // for the one real break this caused (client-side input validation on AI tasks).
  level: CefrSchema,
  sessionSize: z.number().int().min(3).max(20).default(5),
  // docs/decision.md ADR-025 — display name override for the real leaderboard.
  // null means "use the fallback chain" (lib/leaderboard/name.ts): Firebase Auth
  // displayName, then the local part of email, then a generic placeholder. Additive
  // field with a default, same no-migration pattern as `locale`/`sessionSize` above.
  // Deliberately NO `.max()` here: getProfile() (lib/repositories/dexie/
  // user-repository.ts) safeParses the WHOLE settings object and falls back to
  // DEFAULT_SETTINGS wholesale on any failure — a length cap here would mean one
  // over-long nickname silently resets theme/locale/level/sessionSize too. The
  // 40-char cap is enforced non-destructively instead: the Settings input's
  // `maxLength`, and a defensive slice in lib/leaderboard/name.ts before publish.
  leaderboardName: z.string().nullable().default(null),
  levelProfile: LevelProfileSchema.default({
    declared: null,
    placement: null,
    work: null,
    srs: null,
    updatedAt: null,
    lastPromptedAt: null,
  }),
  // docs/decision.md ADR-028 — additive field with a default, same no-migration
  // pattern as `locale`/`sessionSize`/`levelProfile` above.
  learningGoal: LearningGoalSchema.default({ kind: 'custom', text: '', setAt: null }),
});
export type UserSettings = z.infer<typeof UserSettingsSchema>;
