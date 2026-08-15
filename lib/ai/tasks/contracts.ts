import { z } from 'zod';
import { CefrSchema } from '@/lib/domain';

// Client-safe: imported from both the route handlers AND the browser
// (lib/api/ai-client.ts). No prompts, no server config — those live in the
// `*.server.ts` sibling files behind `import 'server-only'` so they can never end
// up in a client bundle (docs/architecture.md §1).

export const TASK_ROUTES = {
  enrichWord: '/api/ai/enrich',
  enrichWordBatch: '/api/ai/enrich-batch',
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
  // Declared LAST so propertyOrdering (lib/ai/gemini-schema.ts) for the existing
  // fields above is unperturbed. Feeds the SRS level signal (lib/level/srs-signal.ts)
  // for words added by hand, not just words that came from the corpus or Learn.
  cefr: CefrSchema.catch('B2'),
});

// docs/decision.md ADR-019 — one request for up to 8 words instead of N separate
// enrichWord calls. The auto top-up (stores/topup-store.ts) needs to enrich a
// handful of corpus words at session-build time; N round trips at enrichWord's
// 20/min-per-IP limit would 429 a shared office NAT in minutes, and N system
// prompts costs N times the token overhead for the same content. `word` is declared
// FIRST in each output item (unlike EnrichWordOutput, where cefr trails) so the
// model anchors each item to the word it's enriching before generating content —
// propertyOrdering (lib/ai/gemini-schema.ts) follows declaration order.
export const EnrichWordBatchInput = z.object({
  words: z.array(z.string().trim().min(1).max(64)).min(1).max(8),
  contextTopic: z.string().trim().min(1).max(80).default('software engineering'),
  level: CefrSchema.default('B2'),
});
const EnrichWordBatchItem = z.object({
  word: z.string().max(64), // echoed back verbatim — the re-keying anchor (stores/topup-store.ts)
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
export const EnrichWordBatchOutput = z.object({
  items: z.array(EnrichWordBatchItem),
});

export const ExtractWordsInput = z.object({
  text: z.string().trim().min(1).max(4000),
  contextTopic: z.string().trim().max(80).default('software engineering'),
  // Widened from 'B1'|'B2'|'C1' to the full CEFR range (docs/decision.md ADR-017) —
  // this is the fix for the break that widening UserSettings.level caused: ai-client.ts
  // parses this input CLIENT-SIDE before the fetch, so a 'C2'/'A1' settings.level would
  // have thrown locally the moment a caller passed it through unchanged.
  level: CefrSchema.default('B2'),
});
export const ExtractWordsOutput = z.object({
  words: z.array(
    z.object({
      word: z.string().max(64),
      reason: z.string().max(200),
    })
  ),
});

export const GradeSentenceInput = z.object({
  word: z.string().trim().min(1).max(64),
  sentence: z.string().trim().min(1).max(300),
  contextTopic: z.string().trim().max(80).default('software engineering'),
});
export const GradeSentenceOutput = z.object({
  isCorrect: z.boolean(),
  feedbackVi: z.string().max(500),
  improvedSentence: z.string().max(300),
});

export const AnalyzeDocumentInput = z.object({
  documentText: z.string().trim().min(1).max(10_000),
  level: CefrSchema.default('B2'),
  contextTopic: z.string().trim().max(80).default('software engineering'),
  excludeWords: z.array(z.string().max(64)).max(500).default([]),
});
const CandidateWordOutput = z.object({
  word: z.string().max(64),
  cefr: CefrSchema.catch('B2'),
  category: z.enum(['academic', 'technical', 'ielts', 'phrasal', 'idiom']).catch('technical'),
  meaningVi: z.string().max(200),
  sentenceFromDoc: z.string().max(300),
  sentenceSource: z.enum(['document', 'generated']).catch('document'),
  // Declared LAST so the model finalizes sentenceFromDoc/sentenceSource before
  // choosing same-slot alternatives to it (docs/decision.md ADR-021) — same
  // propertyOrdering reasoning as EnrichWordOutput's trailing `cefr`.
  distractors: z.array(z.string().max(64)),
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
  level: CefrSchema.default('B2'),
  contextTopic: z.string().trim().max(80).default('software engineering'),
  excludeWords: z.array(z.string().max(64)).max(300).default([]),
});

const WorkVocabItem = z.object({
  text: z.string().max(64),
  cefr: CefrSchema.catch('B2'),
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
    estimatedLevel: CefrSchema.catch('B2'),
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
  enrichWordBatch: { input: EnrichWordBatchInput, output: EnrichWordBatchOutput },
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
