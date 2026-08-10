import { z } from 'zod';
import { ExerciseKindSchema } from './word';

export const ReviewSchema = z.object({
  id: z.string(),
  wordId: z.string(),
  kind: ExerciseKindSchema,
  correct: z.boolean(),
  answeredAt: z.number(),

  // Extended fields — docs/data-model.md §1. Optional for the same reason as
  // Word's extended fields (ADR-007): keeps old review-recording call sites
  // typechecking until Phase 5 rewires them onto StudyRepository.recordReview.
  sessionId: z.string().optional(),
  dayKey: z.string().optional(),
  updatedAt: z.number().optional(),
});
export type Review = z.infer<typeof ReviewSchema>;
