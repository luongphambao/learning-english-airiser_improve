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
  analyzeWork: '/api/ai/analyze-work',
} as const;

export type TaskId = keyof typeof TASK_ROUTES;

export const EnrichWordInput = z.object({
  word: z.string().trim().min(1).max(64),
  contextTopic: z.string().trim().min(1).max(80).default('software engineering'),
});
export const EnrichWordOutput = z.object({
  ipa: z.string().max(64),
  partOfSpeech: z.string().max(32),
  meaningVi: z.string().max(200),
  exampleSentence: z.string().max(300),
  distractors: z.array(z.string().max(64)),
  collocations: z.array(
    z.object({
      phrase: z.string().max(120),
      meaningVi: z.string().max(150),
    })
  ),
  wordFamily: z.array(z.string().max(64)),
});

export const ExtractWordsInput = z.object({
  text: z.string().trim().min(1).max(4000),
  contextTopic: z.string().trim().max(80).default('software engineering'),
  level: z.enum(['B1', 'B2', 'C1']).default('B2'),
});
export const ExtractWordsOutput = z.object({
  words: z.array(
    z.object({
      word: z.string().max(64),
      reason: z.string().max(200),
    })
  ),
});

// `mode: 'rewriteProfessionally'` (docs/decision.md ADR-014) reuses this task for
// grading a saved professional-rewrite exercise instead of adding a 5th task —
// GradeSentenceOutput's shape ({isCorrect, feedbackVi, improvedSentence}) already
// fits that grading exactly. Both new fields default so every existing caller
// (components/ExerciseWrite.tsx's plain word-usage grading) is unaffected.
export const GradeSentenceInput = z.object({
  word: z.string().trim().min(1).max(64),
  sentence: z.string().trim().min(1).max(300),
  contextTopic: z.string().trim().max(80).default('software engineering'),
  mode: z.enum(['useWord', 'rewriteProfessionally']).default('useWord'),
  original: z.string().trim().max(300).default(''),
});
export const GradeSentenceOutput = z.object({
  isCorrect: z.boolean(),
  feedbackVi: z.string().max(500),
  improvedSentence: z.string().max(300),
});

export const AnalyzeDocumentInput = z.object({
  documentText: z.string().trim().min(1).max(10_000),
  level: z.enum(['B1', 'B2', 'C1']).default('B2'),
  contextTopic: z.string().trim().max(80).default('software engineering'),
  excludeWords: z.array(z.string().max(64)).max(500).default([]),
});
const CandidateWordOutput = z.object({
  word: z.string().max(64),
  cefr: z.enum(['B1', 'B2', 'C1', 'C2']).catch('B2'),
  category: z.enum(['academic', 'technical', 'ielts', 'phrasal', 'idiom']).catch('technical'),
  meaningVi: z.string().max(200),
  sentenceFromDoc: z.string().max(300),
  sentenceSource: z.enum(['document', 'generated']).catch('document'),
});
export const AnalyzeDocumentOutput = z.object({
  candidates: z.array(CandidateWordOutput),
});

// "Học từ công việc thật" (Learn From Work) — the signature feature (docs/decision.md
// ADR-014). Unlike analyzeDocument (vocabulary only, tuned for CEFR mining across
// any document), this is tuned for one real piece of the user's own workplace
// English and returns four insight kinds. Every item carries `exampleSentence` +
// `distractors`, deliberately — that is what makes a saved item immediately
// practisable as a fillBlank exercise with zero second AI call (isEligible() in
// lib/srs/session.ts already requires exactly that shape). No `.nullable()` or
// `.union()` anywhere in this schema — see lib/ai/gemini-schema.ts's header comment
// for why that silently breaks the Gemini projection.
export const AnalyzeWorkInput = z.object({
  workText: z.string().trim().min(20).max(10_000),
  sourceType: z.enum(['email', 'report', 'chat', 'other']).default('email'),
  level: z.enum(['B1', 'B2', 'C1']).default('B2'),
  contextTopic: z.string().trim().max(80).default('software engineering'),
  excludeWords: z.array(z.string().max(64)).max(300).default([]),
});

const WorkVocabItem = z.object({
  text: z.string().max(64),
  cefr: z.enum(['B1', 'B2', 'C1', 'C2']).catch('B2'),
  meaningVi: z.string().max(160),
  whyVi: z.string().max(160),
  exampleSentence: z.string().max(240),
  distractors: z.array(z.string().max(64)),
});

const WorkPhraseItem = z.object({
  text: z.string().max(80),
  meaningVi: z.string().max(160),
  usageVi: z.string().max(200),
  exampleSentence: z.string().max(240),
  distractors: z.array(z.string().max(80)),
});

const WorkGrammarItem = z.object({
  original: z.string().max(240),
  corrected: z.string().max(240),
  focusWord: z.string().max(48),
  rule: z.string().max(80),
  explanationVi: z.string().max(240),
  distractors: z.array(z.string().max(48)),
});

const WorkRewriteItem = z.object({
  original: z.string().max(300),
  rewrite: z.string().max(300),
  reasonVi: z.string().max(240),
  keyPhrase: z.string().max(80),
});

// Field order matters here beyond readability: toGeminiSchema sets
// `propertyOrdering` from declaration order, and Gemini generates output in that
// order — `summary` deliberately comes LAST so its counts are written after the
// arrays they describe exist, not guessed up front. The UI must still never trust
// `summary.*Count` outright — see AnalyzeWorkOutput's repair() in registry.server.ts,
// which recomputes every count from the actual array lengths after parsing.
export const AnalyzeWorkOutput = z.object({
  words: z.array(WorkVocabItem),
  phrases: z.array(WorkPhraseItem),
  grammarInsights: z.array(WorkGrammarItem),
  professionalRewrites: z.array(WorkRewriteItem),
  summary: z.object({
    inputTypeVi: z.string().max(60),
    estimatedLevel: z.enum(['A2', 'B1', 'B2', 'C1', 'C2']).catch('B2'),
    headlineVi: z.string().max(200),
    wordCount: z.number().int(),
    phraseCount: z.number().int(),
    grammarCount: z.number().int(),
    rewriteCount: z.number().int(),
    opportunityCount: z.number().int(),
  }),
});

export const TASK_IO = {
  enrichWord: { input: EnrichWordInput, output: EnrichWordOutput },
  extractWords: { input: ExtractWordsInput, output: ExtractWordsOutput },
  gradeSentence: { input: GradeSentenceInput, output: GradeSentenceOutput },
  analyzeDocument: { input: AnalyzeDocumentInput, output: AnalyzeDocumentOutput },
  analyzeWork: { input: AnalyzeWorkInput, output: AnalyzeWorkOutput },
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
