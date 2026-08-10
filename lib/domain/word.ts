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
});
export type Word = z.infer<typeof WordSchema>;
