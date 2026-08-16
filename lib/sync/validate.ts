import { z } from 'zod';
import {
  CefrOrUnknownSchema,
  EntryTypeSchema,
  GrammarAttemptSchema,
  ImportSchema,
  ReviewSchema,
  WordSchema,
} from '@/lib/domain';

/**
 * Row-shape zod schemas for validating what comes back from a Firestore pull
 * — untrusted in the same sense a Dexie row read already is (lib/db/read.ts's
 * safeParseRow), just arriving over the network instead of from IndexedDB.
 * Each one extends the existing domain schema with the extra fields the
 * local Row type adds (lib/db/dexie.ts, lib/db/rows.ts) rather than
 * duplicating the whole shape — see each Row interface's own comment for why
 * every field here exists.
 */

export const WordRowSchema = WordSchema.omit({
  isLeech: true,
  consecutiveCorrect: true,
  updatedAt: true,
  deletedAt: true,
  entryType: true,
  noteVi: true,
  originalText: true,
  cefr: true,
}).extend({
  // IndexedDB can't index a boolean (lib/db/rows.ts) — every row on the wire
  // is already in this 0|1 shape because pushBatch() pushes rows verbatim.
  isLeech: z.union([z.literal(0), z.literal(1)]),
  wordLower: z.string(),
  consecutiveCorrect: z.number(),
  updatedAt: z.number(),
  deletedAt: z.number().nullable(),
  entryType: EntryTypeSchema,
  noteVi: z.string(),
  originalText: z.string().nullable(),
  cefr: CefrOrUnknownSchema,
});

export const ReviewRowSchema = ReviewSchema.extend({
  sessionId: z.string(),
  dayKey: z.string(),
  updatedAt: z.number(),
});

export const ImportRowSchema = ImportSchema.extend({
  updatedAt: z.number(),
});

export const GrammarAttemptRowSchema = GrammarAttemptSchema.extend({
  updatedAt: z.number(),
});

// `skipped` never had a domain zod schema (Dexie-only since v1) — small
// enough to write directly rather than manufacture a domain type for it.
export const SkippedRowSchema = z.object({
  wordLower: z.string(),
  word: z.string(),
  at: z.number(),
  deletedAt: z.number().nullable(),
  updatedAt: z.number(),
});
