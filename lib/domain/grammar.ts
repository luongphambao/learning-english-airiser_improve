import { z } from 'zod';

export const GrammarQuestionSchema = z.object({
  id: z.string(),
  category: z.string(),
  title: z.string(),
  prompt: z.string(),
  sentenceWithBlank: z.string(),
  options: z.array(z.string()),
  correctIndex: z.number(),
  explanationVi: z.string(),
  ruleSummary: z.string(),
});
export type GrammarQuestion = z.infer<typeof GrammarQuestionSchema>;

export const GrammarTopicSchema = z.object({
  id: z.string(),
  titleVi: z.string(),
  descriptionVi: z.string(),
  level: z.string(),
  questions: z.array(GrammarQuestionSchema),
});
export type GrammarTopic = z.infer<typeof GrammarTopicSchema>;

// docs/spec-gaps.md C8 / docs/decision.md ADR-011 — grammar questions have no
// relation to any Word, so a finished quiz cannot go through
// StudyRepository.recordReview() (which requires a real wordId). Independent
// history instead of forcing a fake link: one row per completed quiz run.
export const GrammarAttemptSchema = z.object({
  id: z.string(),
  topicId: z.string(),
  score: z.number(),
  total: z.number(),
  at: z.number(),
});
export type GrammarAttempt = z.infer<typeof GrammarAttemptSchema>;
