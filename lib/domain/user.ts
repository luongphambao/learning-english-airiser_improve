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
  levelProfile: LevelProfileSchema.default({
    declared: null,
    placement: null,
    work: null,
    srs: null,
    updatedAt: null,
    lastPromptedAt: null,
  }),
});
export type UserSettings = z.infer<typeof UserSettingsSchema>;
