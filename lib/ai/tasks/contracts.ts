import { z } from 'zod';

// Client-safe: imported from both the route handlers AND the browser
// (lib/api/ai-client.ts). No prompts, no server config — those live in the
// `*.server.ts` sibling files behind `import 'server-only'` so they can never end
// up in a client bundle (docs/architecture.md §1).

export const TASK_ROUTES = {
  enrichWord: '/api/ai/enrich',
  extractWords: '/api/ai/extract',
  gradeSentence: '/api/ai/grade-sentence',
  analyzeDocument: '/api/ai/analyze-doc',
} as const;

export type TaskId = keyof typeof TASK_ROUTES;

export const EnrichWordInput = z.object({
  word: z.string().trim().min(1).max(64),
  contextTopic: z.string().trim().min(1).max(80).default('software engineering'),
});
export const EnrichWordOutput = z.object({
  ipa: z.string().max(64),
  partOfSpeech: z.string().max(24),
  meaningVi: z.string().max(160),
  exampleSentence: z.string().max(240),
  distractors: z.array(z.string().max(48)).length(3),
  collocations: z.array(z.object({ phrase: z.string().max(96), meaningVi: z.string().max(120) })).length(3),
  wordFamily: z.array(z.string().max(48)).max(3),
});

export const ExtractWordsInput = z.object({
  text: z.string().trim().min(1).max(4000),
  contextTopic: z.string().trim().max(80).default('software engineering'),
  level: z.enum(['B1', 'B2', 'C1']).default('B2'),
});
export const ExtractWordsOutput = z.object({
  words: z.array(z.object({ word: z.string().max(64), reason: z.string().max(160) })).max(12),
});

export const GradeSentenceInput = z.object({
  word: z.string().trim().min(1).max(64),
  sentence: z.string().trim().min(1).max(300),
  contextTopic: z.string().trim().max(80).default('software engineering'),
});
export const GradeSentenceOutput = z.object({
  isCorrect: z.boolean(),
  feedbackVi: z.string().max(300),
  improvedSentence: z.string().max(240),
});

export const AnalyzeDocumentInput = z.object({
  documentText: z.string().trim().min(1).max(10_000),
  level: z.enum(['B1', 'B2', 'C1']).default('B2'),
  contextTopic: z.string().trim().max(80).default('software engineering'),
  excludeWords: z.array(z.string().max(64)).max(500).default([]),
});
const CandidateWordOutput = z.object({
  word: z.string().max(64),
  cefr: z.enum(['B1', 'B2', 'C1', 'C2']),
  category: z.enum(['academic', 'technical', 'ielts', 'phrasal', 'idiom']),
  meaningVi: z.string().max(160),
  sentenceFromDoc: z.string().max(240),
  sentenceSource: z.enum(['document', 'generated']),
});
export const AnalyzeDocumentOutput = z.object({
  candidates: z.array(CandidateWordOutput).max(40),
});

export const TASK_IO = {
  enrichWord: { input: EnrichWordInput, output: EnrichWordOutput },
  extractWords: { input: ExtractWordsInput, output: ExtractWordsOutput },
  gradeSentence: { input: GradeSentenceInput, output: GradeSentenceOutput },
  analyzeDocument: { input: AnalyzeDocumentInput, output: AnalyzeDocumentOutput },
} as const;

// Two different shapes for "input", because zod's `.default()` fields are optional
// going IN and required coming OUT:
// - TaskInput: what a caller may pass to callTask() — defaulted fields (contextTopic,
//   level, ...) are optional. This is z.input, not z.infer/z.output.
// - TaskParsedInput: what a ServerTask's system()/prompt() functions receive after
//   `task.input.parse(raw)` has run — defaults are already applied, so those same
//   fields are guaranteed present. This is the ordinary z.output/z.infer shape.
export type TaskInput<K extends TaskId> = z.input<(typeof TASK_IO)[K]['input']>;
export type TaskParsedInput<K extends TaskId> = z.output<(typeof TASK_IO)[K]['input']>;
export type TaskOutput<K extends TaskId> = z.output<(typeof TASK_IO)[K]['output']>;
