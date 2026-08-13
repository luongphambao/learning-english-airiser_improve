import { z } from 'zod';
import { WorkAnalysisSchema } from './work';

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

// docs/decision.md ADR-014: a "Học từ công việc thật" analysis reuses this table
// (kind 'work') rather than a parallel `workAnalyses` table — an Import already is
// "one row per paste/upload, analyzing -> ready -> done|failed, with a Vietnamese
// error string", which is exactly what a work analysis needs. `candidates` stays
// [] for kind 'work' rows; `analysis` stays null until status becomes 'ready'.
export const ImportSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  kind: z.enum(['pdf', 'image', 'text', 'work']),
  createdAt: z.number(),
  status: z.enum(['analyzing', 'ready', 'done', 'failed']),
  candidates: z.array(CandidateWordSchema),
  addedCount: z.number(),
  // Vietnamese message shown on the "Lỗi đọc file" screen when status is 'failed' —
  // see lib/api/problem.ts for the same vocabulary used by /api/ai/* routes.
  error: z.string().nullable().optional(),
  // kind 'work' only, both optional so every pre-v3 row still parses unchanged:
  rawText: z.string().optional(), // the pasted/uploaded text — needed to retry a failed analysis
  analysis: WorkAnalysisSchema.nullable().optional(),
});
export type Import = z.infer<typeof ImportSchema>;
