import { create } from 'zustand';
import { getRepos } from '@/lib/repositories';
import { callTask } from '@/lib/api/ai-client';
import { ApiError } from '@/lib/api/client';
import { buildExclusionSet } from '@/lib/corpus/exclude';
import { topicSourceLabel } from '@/lib/i18n/source-label';
import { apiErrorKey, ERROR_KEY } from '@/lib/i18n/api-error';
import type { Cefr, KnownState } from '@/lib/domain';

/** One AI-proposed word, before the learner has triaged it. */
export interface TopicCandidate {
  word: string;
  cefr: Cefr;
  meaningVi: string;
  exampleSentence: string;
  distractors: string[];
}

interface SuggestInput {
  topic: string;
  level: Cefr;
  contextTopic: string;
  goal: string;
}

interface SaveTriageResult {
  added: number;
  skipped: number;
}

interface TopicStoreState {
  status: 'idle' | 'suggesting' | 'ready' | 'saving' | 'done' | 'error';
  topic: string;
  candidates: TopicCandidate[];
  /** What the last saveTriage() wrote — lives here rather than in the component for
   * the same reason as doc-store's: a tab switch unmounts the component but leaves
   * this module-level singleton's `status` at 'done'. */
  savedResult: SaveTriageResult | null;
  /** A marked i18n key, not a sentence (lib/i18n/api-error.ts) — the component
   * resolves it, so the message follows the interface language instead of freezing
   * in whichever one was active when the call failed. */
  errorKey: string | null;
  suggest(input: SuggestInput): Promise<void>;
  saveTriage(choices: Record<string, KnownState>, now: number): Promise<SaveTriageResult>;
  reset(): void;
}

/**
 * "Học từ mới theo chủ đề" (docs/decision.md ADR-028) — the third source of new
 * words. Same store-owns-the-AI-call shape as doc-store.ts / work-store.ts
 * (docs/architecture.md §1), with two deliberate differences:
 *
 * - **No `Import` row.** The other two flows persist one because they have a
 *   document worth reopening later; a topic has nothing to reopen and re-running it
 *   is a single cheap call. Writing one would mean widening `Import['kind']` and
 *   dragging the sync layer along for no user-visible gain — topup-store, the other
 *   AI flow with no source document, doesn't write one either.
 * - **Save goes through `addFromCorpus`**, exactly the two branches placement's
 *   `confirmTriage` uses: 'known' -> `skipped` (so the word never resurfaces via
 *   `buildExclusionSet`), anything else -> the notebook, already scheduled.
 */
export const useTopicStore = create<TopicStoreState>()((set, get) => ({
  status: 'idle',
  topic: '',
  candidates: [],
  savedResult: null,
  errorKey: null,

  async suggest({ topic, level, contextTopic, goal }) {
    set({ status: 'suggesting', topic, candidates: [], savedResult: null, errorKey: null });

    // Unions the notebook (including tombstones) with `skipped` — asking for the
    // same topic twice must not re-propose words already saved or already dismissed
    // as known.
    const excludeWords = [...(await buildExclusionSet())].slice(0, 300);

    try {
      const result = await callTask('suggestTopicWords', { topic, level, contextTopic, goal, excludeWords });
      if (result.words.length === 0) {
        set({ status: 'error', errorKey: ERROR_KEY.topicEmpty });
        return;
      }
      set({ candidates: result.words, status: 'ready' });
    } catch (err) {
      set({ status: 'error', errorKey: err instanceof ApiError ? apiErrorKey(err.code) : ERROR_KEY.topicFailed });
    }
  },

  async saveTriage(choices, now) {
    const { candidates, topic } = get();
    set({ status: 'saving' });

    const repos = getRepos();
    let added = 0;
    let skipped = 0;

    for (const candidate of candidates) {
      const triage = choices[candidate.word] ?? 'unknown';
      if (triage === 'known') {
        await repos.skipped.add(candidate.word, now);
        skipped += 1;
        continue;
      }
      await repos.words.addFromCorpus({
        word: candidate.word,
        meaningVi: candidate.meaningVi,
        exampleSentence: candidate.exampleSentence,
        distractors: candidate.distractors,
        cefr: candidate.cefr,
        source: { kind: 'session', label: topicSourceLabel(topic), at: now },
        triage,
        now,
      });
      added += 1;
    }

    const result = { added, skipped };
    set({ status: 'done', savedResult: result });
    return result;
  },

  reset() {
    set({ status: 'idle', topic: '', candidates: [], savedResult: null, errorKey: null });
  },
}));
