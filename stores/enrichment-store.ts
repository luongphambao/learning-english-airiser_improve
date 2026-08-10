import { create } from 'zustand';
import { getRepos } from '@/lib/repositories';
import { callTask } from '@/lib/api/ai-client';

interface EnrichmentStoreState {
  pendingIds: Set<string>;
  failedIds: Set<string>;
  enrich(wordId: string, contextTopic?: string): Promise<void>;
  retry(wordId: string, contextTopic?: string): Promise<void>;
}

function withId(set: Set<string>, id: string): Set<string> {
  const next = new Set(set);
  next.add(id);
  return next;
}

function withoutId(set: Set<string>, id: string): Set<string> {
  const next = new Set(set);
  next.delete(id);
  return next;
}

/**
 * docs/decision.md ADR — this is what makes bug #9 (audit — enrichment never runs
 * because `enrichWordAsync` searched a stale in-memory `words` array right after
 * `setWords` queued the new word) structurally impossible: `enrich(id)` always
 * re-reads the word FROM THE REPOSITORY by id, never from a snapshot passed in by
 * the caller. Goes through lib/api/ai-client.ts (Phase 6) — same-shape validated
 * request/response, provider-agnostic (AI_PROVIDER env var), no direct fetch here.
 */
export const useEnrichmentStore = create<EnrichmentStoreState>()((set) => ({
  pendingIds: new Set(),
  failedIds: new Set(),

  async enrich(wordId, contextTopic) {
    const repos = getRepos();
    const word = await repos.words.get(wordId);
    if (!word) return;

    set((s) => ({ pendingIds: withId(s.pendingIds, wordId), failedIds: withoutId(s.failedIds, wordId) }));
    try {
      const data = await callTask('enrichWord', { word: word.word, contextTopic });

      await repos.words.patch(wordId, {
        ipa: data.ipa,
        partOfSpeech: data.partOfSpeech,
        meaningVi: data.meaningVi,
        exampleSentence: data.exampleSentence,
        distractors: data.distractors,
        collocations: data.collocations,
        wordFamily: data.wordFamily,
      });
      set((s) => ({ failedIds: withoutId(s.failedIds, wordId) }));
    } catch {
      set((s) => ({ failedIds: withId(s.failedIds, wordId) }));
    } finally {
      set((s) => ({ pendingIds: withoutId(s.pendingIds, wordId) }));
    }
  },

  async retry(wordId, contextTopic) {
    await useEnrichmentStore.getState().enrich(wordId, contextTopic);
  },
}));
