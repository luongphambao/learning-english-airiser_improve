import 'server-only';
import { defineSchema } from '../schema';
import {
  TASK_ROUTES,
  EnrichWordInput, EnrichWordOutput,
  ExtractWordsInput, ExtractWordsOutput,
  GradeSentenceInput, GradeSentenceOutput,
  AnalyzeDocumentInput, AnalyzeDocumentOutput,
  type TaskId, type TaskParsedInput, type TaskOutput,
} from './contracts';
import type { StructuredSchema } from '../schema';
import type { PromptPart } from '../types';
import type { z } from 'zod';

export interface ServerTask<I, O> {
  id: TaskId;
  route: string;
  input: z.ZodType<I>;
  output: StructuredSchema<O>;
  system: (input: I) => string;
  prompt: (input: I) => PromptPart[];
  timeoutMs: number;
  maxDuration: number;
  rateLimit: { perMinute: number; perDay: number };
  temperature?: number;
  requires?: { inlineFiles?: boolean };
  /** Post-parse repair for constraints OpenAI's strict schema mode can't enforce
   * (exact array lengths) — see docs/decision.md ADR-009. */
  repair?: (raw: O) => O;
}

// Prompts below are lifted verbatim from the old app/api/gemini/* routes — they
// were the best-engineered part of the baseline (docs/progress/00-baseline-audit.md
// §8) and are preserved unchanged, just moved out of the route handler.

export const enrichWordTask: ServerTask<TaskParsedInput<'enrichWord'>, TaskOutput<'enrichWord'>> = {
  id: 'enrichWord',
  route: TASK_ROUTES.enrichWord,
  input: EnrichWordInput,
  output: defineSchema('enrich_word', EnrichWordOutput),
  timeoutMs: 25_000,
  maxDuration: 30,
  rateLimit: { perMinute: 20, perDay: 400 },
  temperature: 0.5,
  system: ({ contextTopic }) =>
    `You enrich English vocabulary entries for a Vietnamese professional learning English for work. ` +
    `Example sentences must be natural, under 16 words, and set in a ${contextTopic} workplace context. ` +
    `The Vietnamese meaning must be one short line, no more than 12 words. Distractors must be real English ` +
    `words of the same part of speech, plausible in the same sentence slot, but clearly wrong on reflection. ` +
    `Collocations must be phrases a native speaker actually says — verb + noun, adjective + noun, or noun + ` +
    `preposition — not dictionary definitions. Prefer collocations common in professional writing.`,
  prompt: ({ word }) => [{ kind: 'text', text: `Enrich English vocabulary word: "${word}"` }],
  repair: (raw) => ({
    ...raw,
    distractors: raw.distractors.slice(0, 3),
    collocations: raw.collocations.slice(0, 3),
    wordFamily: raw.wordFamily.slice(0, 3),
  }),
};

export const extractWordsTask: ServerTask<TaskParsedInput<'extractWords'>, TaskOutput<'extractWords'>> = {
  id: 'extractWords',
  route: TASK_ROUTES.extractWords,
  input: ExtractWordsInput,
  output: defineSchema('extract_words', ExtractWordsOutput),
  timeoutMs: 20_000,
  maxDuration: 25,
  rateLimit: { perMinute: 15, perDay: 200 },
  system: () =>
    `Extract up to 12 English vocabulary items worth learning for a Vietnamese professional. Return words ` +
    `ordered by usefulness. Reason must be a short Vietnamese clause explaining why this word is valuable in ` +
    `workplace/tech context.`,
  prompt: ({ text, contextTopic, level }) => [
    {
      kind: 'text',
      text: `Extract useful English vocabulary from this text for a Vietnamese professional (${level} level, field: ${contextTopic}):\n\n"${text}"`,
    },
  ],
  repair: (raw) => ({ words: raw.words.slice(0, 12) }),
};

export const gradeSentenceTask: ServerTask<TaskParsedInput<'gradeSentence'>, TaskOutput<'gradeSentence'>> = {
  id: 'gradeSentence',
  route: TASK_ROUTES.gradeSentence,
  input: GradeSentenceInput,
  output: defineSchema('grade_sentence', GradeSentenceOutput),
  timeoutMs: 20_000,
  maxDuration: 25,
  rateLimit: { perMinute: 20, perDay: 300 },
  system: ({ word, contextTopic }) =>
    `You grade an English sentence written by a Vietnamese professional practicing the target word "${word}". ` +
    `Rubric: Correct if the target word is used with the right meaning and part of speech, and the sentence is ` +
    `grammatical enough to be understood by a native speaker in a ${contextTopic} context. Minor article or ` +
    `preposition slips do not make it incorrect — mention them in feedback instead. feedbackVi must be one or ` +
    `two short, encouraging Vietnamese sentences, naming the specific point to fix or praise. improvedSentence ` +
    `must provide a natural native version of the sentence.`,
  prompt: ({ word, sentence }) => [
    { kind: 'text', text: `Target Word: "${word}"\nUser Sentence: "${sentence}"` },
  ],
};

export const analyzeDocumentTask: ServerTask<TaskParsedInput<'analyzeDocument'>, TaskOutput<'analyzeDocument'>> = {
  id: 'analyzeDocument',
  route: TASK_ROUTES.analyzeDocument,
  input: AnalyzeDocumentInput,
  output: defineSchema('analyze_document', AnalyzeDocumentOutput),
  timeoutMs: 45_000,
  maxDuration: 60,
  rateLimit: { perMinute: 5, perDay: 40 },
  system: ({ level, contextTopic }) =>
    `You find vocabulary worth learning in a document, for a Vietnamese professional at CEFR level ${level} ` +
    `working in ${contextTopic}. Return only words at or above the level just past theirs — a B2 learner gets ` +
    `B2, C1 and C2 words, never A2 or B1. Prefer words that recur across many texts over one-off jargon. ` +
    `Include multi-word phrasal verbs and idioms when they carry meaning that cannot be guessed from the ` +
    `parts. Return the lemma, not the inflected form found in the text. For sentenceFromDoc, copy the sentence ` +
    `from the document verbatim, trimmed to at most 24 words. If no complete sentence exists, write one ` +
    `natural sentence yourself using surrounding subject matter and set sentenceSource to "generated". Return ` +
    `at most 40 candidates ordered by usefulness. Never include a word from the exclusion list.`,
  prompt: ({ documentText, excludeWords }) => [
    {
      kind: 'text',
      text: `Exclusion list (do NOT include these words): ${JSON.stringify(excludeWords)}\n\nDocument Text:\n"${documentText}"`,
    },
  ],
  repair: (raw) => ({ candidates: raw.candidates.slice(0, 40) }),
};

// function params are contravariant, so a Record<TaskId, ServerTask<unknown,
// unknown>> rejects every concrete task; `any` here is the standard escape hatch
// for a heterogeneous map of generics, same as the design in docs/architecture.md.
export const TASKS = {
  enrichWord: enrichWordTask,
  extractWords: extractWordsTask,
  gradeSentence: gradeSentenceTask,
  analyzeDocument: analyzeDocumentTask,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} satisfies Record<TaskId, ServerTask<any, any>>;
