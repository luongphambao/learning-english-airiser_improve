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

// docs/decision.md ADR-016 — CEFR band, added once the app gained an actual
// vocabulary corpus (lib/corpus/**) and a leveling engine (lib/level/**) to make use
// of it. `CEFR_ORDER` is the single ordering every level-comparison in the app reads
// (lib/level/cefr.ts's cefrIndex/clampCefr/stepCefr are thin wrappers over it).
export const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export const CefrSchema = z.enum(CEFR_ORDER);
export type Cefr = z.infer<typeof CefrSchema>;

// `Word.cefr` allows 'unknown' in the DOMAIN enum (not only the row) on purpose: if
// this were the strict 6-band CefrSchema, `fromRow` (lib/db/rows.ts) would have to
// map 'unknown' -> undefined, and forgetting that turns into every word in the
// notebook failing safeParseRow and getting quarantined — a silently empty notebook,
// not a loud error. Keeping 'unknown' valid here keeps `fromRow` a pure spread; the
// worst case of getting this wrong is a badge rendering the string "unknown".
export const CefrOrUnknownSchema = z.enum([...CEFR_ORDER, 'unknown']);
export type CefrOrUnknown = z.infer<typeof CefrOrUnknownSchema>;

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

  // v4 field — docs/decision.md ADR-016. Optional for the same reason as the v3
  // fields above: absent on every pre-v4 row, backfilled to 'unknown' by Dexie v4's
  // upgrade() (lib/db/dexie.ts) rather than required here.
  cefr: CefrOrUnknownSchema.optional(), // absent/undefined means 'unknown' (not assessed)
});
export type Word = z.infer<typeof WordSchema>;
