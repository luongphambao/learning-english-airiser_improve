import { z } from 'zod';

export const KnownStateSchema = z.enum(['known', 'partial', 'unknown']);
export type KnownState = z.infer<typeof KnownStateSchema>;

export const CandidateWordSchema = z.object({
  word: z.string(), // lemma form
  cefr: z.enum(['B1', 'B2', 'C1', 'C2']),
  category: z.enum(['academic', 'technical', 'ielts', 'phrasal', 'idiom']),
  meaningVi: z.string(),
  sentenceFromDoc: z.string(),
  sentenceSource: z.enum(['document', 'generated']),
  triage: KnownStateSchema.nullable(),
});
export type CandidateWord = z.infer<typeof CandidateWordSchema>;

export const ImportSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  kind: z.enum(['pdf', 'image', 'text']),
  createdAt: z.number(),
  status: z.enum(['analyzing', 'ready', 'done', 'failed']),
  candidates: z.array(CandidateWordSchema),
  addedCount: z.number(),
  // Vietnamese message shown on the "Lỗi đọc file" screen when status is 'failed' —
  // see lib/api/problem.ts for the same vocabulary used by /api/ai/* routes.
  error: z.string().nullable().optional(),
});
export type Import = z.infer<typeof ImportSchema>;
