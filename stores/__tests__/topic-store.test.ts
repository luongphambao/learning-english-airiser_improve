import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { resetDbForTests } from '@/lib/db/dexie';
import { resetRepos, getRepos } from '@/lib/repositories';
import { useTopicStore } from '../topic-store';
import type { KnownState } from '@/lib/domain';

// Same relative-URL shim as topup-store.test.ts — see that file's header comment
// for why production code keeps its relative fetch paths.
let realFetch: typeof fetch;

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
  realFetch = globalThis.fetch;
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    const absolute =
      typeof input === 'string' && input.startsWith('/') ? new URL(input, 'http://localhost') : input;
    return realFetch(absolute, init);
  });
});
afterEach(() => server.resetHandlers());
afterAll(() => {
  server.close();
  vi.unstubAllGlobals();
});

const NOW = Date.UTC(2026, 5, 1, 12);

function suggestion(word: string) {
  return {
    word,
    cefr: 'B2' as const,
    meaningVi: `nghĩa ${word}`,
    exampleSentence: `A sentence containing ${word} today.`,
    distractors: ['alpha', 'beta', 'gamma'],
  };
}

/** Captures the request body so the exclusion-list assertions can read it. */
function mockSuggest(words: string[], onRequest?: (body: Record<string, unknown>) => void) {
  server.use(
    http.post('http://localhost/api/ai/suggest-words', async ({ request }) => {
      onRequest?.((await request.json()) as Record<string, unknown>);
      return HttpResponse.json({ words: words.map(suggestion) });
    }),
  );
}

const INPUT = { topic: 'môi trường', level: 'B2' as const, contextTopic: 'general', goal: 'IELTS 6.5' };

describe('topic-store suggest', () => {
  beforeEach(() => {
    resetDbForTests();
    resetRepos();
    useTopicStore.getState().reset();
  });

  it('happy path: exposes every suggested word for triage', async () => {
    mockSuggest(['carbon', 'emission', 'renewable']);

    await useTopicStore.getState().suggest(INPUT);

    const state = useTopicStore.getState();
    expect(state.status).toBe('ready');
    expect(state.topic).toBe('môi trường');
    expect(state.candidates.map((c) => c.word)).toEqual(['carbon', 'emission', 'renewable']);
  });

  it('excludes words already in the notebook and words already marked known', async () => {
    const repos = getRepos();
    await repos.words.add({ word: 'carbon', source: { kind: 'manual', label: '', at: NOW } });
    await repos.skipped.add('emission', NOW);

    let body: Record<string, unknown> | undefined;
    mockSuggest(['renewable'], (b) => {
      body = b;
    });

    await useTopicStore.getState().suggest(INPUT);

    const excluded = body?.excludeWords as string[];
    expect(excluded).toContain('carbon');
    expect(excluded).toContain('emission');
  });

  it('reports an empty result as an error rather than an empty triage screen', async () => {
    mockSuggest([]);

    await useTopicStore.getState().suggest(INPUT);

    expect(useTopicStore.getState().status).toBe('error');
    expect(useTopicStore.getState().candidates).toEqual([]);
  });

  it('surfaces a failed call as an error and writes nothing', async () => {
    server.use(
      http.post('http://localhost/api/ai/suggest-words', () =>
        HttpResponse.json({ error: { code: 'upstream_unavailable', message: 'lỗi', requestId: 'x' } }, { status: 503 }),
      ),
    );

    await useTopicStore.getState().suggest(INPUT);

    expect(useTopicStore.getState().status).toBe('error');
    expect(useTopicStore.getState().error).toBeTruthy();
    expect(await getRepos().words.list({ limit: 10 })).toEqual([]);
  });
});

describe('topic-store saveTriage', () => {
  beforeEach(async () => {
    resetDbForTests();
    resetRepos();
    useTopicStore.getState().reset();
    mockSuggest(['carbon', 'emission', 'renewable']);
    await useTopicStore.getState().suggest(INPUT);
  });

  it("routes 'known' to the skipped list and everything else into the notebook", async () => {
    const choices: Record<string, KnownState> = { carbon: 'known', emission: 'partial', renewable: 'unknown' };

    const result = await useTopicStore.getState().saveTriage(choices, NOW);

    expect(result).toEqual({ added: 2, skipped: 1 });
    expect(useTopicStore.getState().status).toBe('done');

    const words = await getRepos().words.list({ limit: 10 });
    expect(words.map((w) => w.word).sort()).toEqual(['emission', 'renewable']);
    expect(await getRepos().skipped.listLowercase()).toEqual(['carbon']);
  });

  it('saves words already practisable as fillBlank — sentence plus three distractors', async () => {
    await useTopicStore.getState().saveTriage({ carbon: 'unknown' }, NOW);

    const saved = await getRepos().words.getByWord('carbon');
    expect(saved?.exampleSentence).toContain('carbon');
    expect(saved?.distractors).toHaveLength(3);
  });

  it('stores the topic as a translatable source label, not a frozen phrase', async () => {
    await useTopicStore.getState().saveTriage({ carbon: 'unknown' }, NOW);

    const saved = await getRepos().words.getByWord('carbon');
    expect(saved?.source.label).toBe('@vocabulary.sourceKind.topic|môi trường');
  });
});
