import { z } from 'zod';

// The tutor-booking FEATURE was removed (docs/decision.md ADR-013 / the AI Riser
// strategy doc §18 — the old UI faked a Google Meet link with Math.random() and
// claimed a booking had been saved when nothing was). `Session` survives here only
// because `lib/db/dexie.ts`'s `tutorSessions` table was declared in the shipped
// `version(1).stores()` block, and that block can never be edited (additive-only
// migrations — see docs/data-model.md). The table stays empty/unused; this type
// exists solely so its `Table<Session, string>` declaration still compiles.
export const SessionSchema = z.object({
  id: z.string(),
  tutorId: z.string(),
  tutorName: z.string(),
  startsAt: z.number(),
  meetUrl: z.string(),
  calendarEventId: z.string().optional(),
  status: z.enum(['upcoming', 'done', 'cancelled']),
  harvestedWordIds: z.array(z.string()).optional(),
});
export type Session = z.infer<typeof SessionSchema>;
