import { z } from 'zod';

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

export const UserSettingsSchema = z.object({
  reminderHour: z.number().nullable(),
  studyTime: z.string().nullable(),
  theme: z.enum(['light', 'dark', 'system']),
  contextTopic: z.string(),
  level: z.enum(['B1', 'B2', 'C1']),
});
export type UserSettings = z.infer<typeof UserSettingsSchema>;
