import { z } from 'zod';

// Tutor booking domain — distinct from the "study session" concept in lib/srs/session.ts
// (a frozen list of 5 exercise items, docs/decision.md ADR-004). This `Session` name is
// kept from the original types.ts for backward compatibility with existing imports.
export const TutorSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  photoUrl: z.string(),
  bio: z.string(),
  availableSlots: z.array(z.number()),
});
export type Tutor = z.infer<typeof TutorSchema>;

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
