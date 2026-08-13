import { z } from 'zod';

export const ExerciseKindSchema = z.enum(['fillBlank', 'listen', 'write', 'recall', 'grammar']);
export type ExerciseKind = z.infer<typeof ExerciseKindSchema>;

export const CollocationSchema = z.object({
  phrase: z.string(),
  meaningVi: z.string(),
});
export type Collocation = z.infer<typeof CollocationSchema>;

export const WordSourceSchema = z.object({
  kind: z.enum(['manual', 'paste', 'session', 'share']),
  label: z.string(),
  at: z.number(),
});
export type WordSource = z.infer<typeof WordSourceSchema>;

export const WordStatusSchema = z.enum(['new', 'learning', 'known']);
export type WordStatus = z.infer<typeof WordStatusSchema>;

// docs/decision.md ADR-014 — "Học từ công việc thật" (Learn From Work) saves
// phrases and grammar fixes as `words` rows carrying this discriminator, instead
// of a separate `phrases` table. Absent (pre-v3 rows) means 'word'. This is what
// lets nextSchedule/recordReview/buildSession/isEligible (lib/srs/**,
// lib/repositories/dexie/study-repository.ts) schedule and practice a saved phrase
// with zero changes to any of them — they only ever see a `Word`. A saved
// professional-rewrite's reusable phrase is tagged 'phrase' too (not a 4th value)
// — nothing in scheduling/practice distinguishes it from a phrase found directly.
export const EntryTypeSchema = z.enum(['word', 'phrase', 'grammar']);
export type EntryType = z.infer<typeof EntryTypeSchema>;

export const WordSchema = z.object({
  id: z.string(),
  word: z.string(),
  ipa: z.string(),
  partOfSpeech: z.string(),
  meaningVi: z.string(),
  exampleSentence: z.string(),
  distractors: z.array(z.string()),
  collocations: z.array(CollocationSchema),
  wordFamily: z.array(z.string()),
  source: WordSourceSchema,
  audioUrl: z.string().nullable(),
  createdAt: z.number(),
  dueAt: z.number(),
  easeLevel: z.number(), // 0..5, index into INTERVALS_DAYS (lib/srs)
  reviewCount: z.number(),
  lapseCount: z.number(),
  isLeech: z.boolean(),
  status: WordStatusSchema,

  // Extended fields — docs/decision.md ADR-007. Optional (not `.default()`) on
  // purpose: this keeps them optional on the inferred `Word` TS type, so code that
  // still builds Word literals without them (context/WordsContext.tsx, until Phase 5
  // replaces it) keeps typechecking unmodified. lib/db/rows.ts fills concrete
  // defaults at the Dexie boundary — see data-model.md §1.
  consecutiveCorrect: z.number().optional(),
  updatedAt: z.number().optional(),
  deletedAt: z.number().nullable().optional(),

  // v3 fields — docs/decision.md ADR-014. Optional for the same reason as the
  // ADR-007 fields above: absent on every pre-v3 row, backfilled by Dexie v3's
  // upgrade() (lib/db/dexie.ts) rather than required here.
  entryType: EntryTypeSchema.optional(), // absent/undefined means 'word'
  noteVi: z.string().optional(), // why it matters / when to use it / the grammar rule, in Vietnamese
  originalText: z.string().nullable().optional(), // grammar/rewrite only: what the user actually wrote
});
export type Word = z.infer<typeof WordSchema>;
