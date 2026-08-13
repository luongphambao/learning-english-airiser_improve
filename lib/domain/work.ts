import { z } from 'zod';

// "Học từ công việc thật" (Learn From Work) result, normalized for the UI/save
// flow. The AI task (lib/ai/tasks/contracts.ts AnalyzeWorkOutput) returns 4
// separate arrays; lib/work/insights.ts's mapAnalyzeWorkOutput() flattens the
// bulk-selectable 3 (words/phrases/grammarInsights) into one ordered `insights`
// list so the review UI, the save loop and the practice builder are each a single
// uniform pass. Rewrites stay a distinct, smaller array — the demo's strongest
// visual moment (strategy doc §29) is a standalone card per rewrite, not a
// checkbox row, and each only has one thing worth saving: its `keyPhrase`.
//
// This schema is domain-side (persisted, `.nullable()` is fine here) — distinct
// from AnalyzeWorkOutput (the raw AI-task wire schema, which must stay
// `.nullable()`-free — see lib/ai/gemini-schema.ts).

export const WorkInsightKindSchema = z.enum(['vocab', 'phrase', 'grammar']);
export type WorkInsightKind = z.infer<typeof WorkInsightKindSchema>;

export const WorkInsightSchema = z.object({
  id: z.string(), // stable within one analysis: `${kind}-${index}` — survives a resume
  kind: WorkInsightKindSchema,
  text: z.string(), // the learnable chunk — becomes Word.word if saved
  meaningVi: z.string(),
  noteVi: z.string(), // whyVi / usageVi / explanationVi, unified — becomes Word.noteVi
  exampleSentence: z.string(),
  distractors: z.array(z.string()),
  originalText: z.string().nullable(), // grammar only: what the user actually wrote
  ruleLabel: z.string().nullable(), // grammar only: e.g. "Subject-verb agreement"
  cefr: z.enum(['B1', 'B2', 'C1', 'C2']).nullable(), // vocab only
  saved: z.boolean(),
});
export type WorkInsight = z.infer<typeof WorkInsightSchema>;

export const WorkRewriteCardSchema = z.object({
  id: z.string(),
  original: z.string(),
  rewrite: z.string(),
  reasonVi: z.string(),
  keyPhrase: z.string(),
  saved: z.boolean(),
});
export type WorkRewriteCard = z.infer<typeof WorkRewriteCardSchema>;

export const WorkSummarySchema = z.object({
  inputTypeVi: z.string(),
  estimatedLevel: z.string(),
  headlineVi: z.string(),
  wordCount: z.number(),
  phraseCount: z.number(),
  grammarCount: z.number(),
  rewriteCount: z.number(),
  opportunityCount: z.number(),
});
export type WorkSummary = z.infer<typeof WorkSummarySchema>;

export const WorkAnalysisSchema = z.object({
  // Which provider actually produced this isn't threaded through here — postJson/
  // callTask (lib/api/client.ts, lib/api/ai-client.ts) return only the parsed body,
  // not response headers, and changing that return contract would touch every
  // existing caller. The UI's "Gemini" framing is accurate for this build's actual
  // default (lib/ai/config.ts, docs/decision.md ADR-012) but would go stale if a
  // deployment explicitly sets AI_PROVIDER=openai — a real gap, not a P0 fix.
  summary: WorkSummarySchema,
  insights: z.array(WorkInsightSchema),
  rewrites: z.array(WorkRewriteCardSchema),
});
export type WorkAnalysis = z.infer<typeof WorkAnalysisSchema>;
