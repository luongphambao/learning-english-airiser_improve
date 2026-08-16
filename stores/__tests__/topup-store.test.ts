import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { resetDbForTests } from '@/lib/db/dexie';
import { resetRepos, getRepos } from '@/lib/repositories';
import { clearCorpusMemoForTests } from '@/lib/corpus/load';
import { useTopupStore } from '../topup-store';

// Node's fetch (unlike a browser's) refuses a relative URL outright — there is no
// document to resolve it against — so postJson('/api/ai/enrich-batch', ...) and
// loadBand's fetch('/corpus/v1/B2.json') both throw before msw's interceptor ever
// sees the request. Rather than change production code (relative URLs are exactly
// right in the browser) just to make it testable, this shim rewrites a leading `/`
// to an absolute http://localhost origin and delegates to whatever `fetch` is
// current AFTER server.listen() has run — i.e. msw's own patched fetch — so real
// msw request handlers still do the matching and responding.
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

const CORPUS_BAND = (band: string, rows: [string, string, number, string][]) => ({
  band,
  count: rows.length,
  source: 'authored',
  cols: ['w', 'pos', 'rank', 'vi'],
  rows,
});

function mockCorpus(bands: Record<string, [string, string, number, string][]>) {
  server.use(
    http.get('http://localhost/corpus/v1/:band.json', ({ params }) => {
      const band = String(params.band);
      const rows = bands[band] ?? [];
      return HttpResponse.json(CORPUS_BAND(band, rows));
    }),
  );
}

const NOW = Date.UTC(2026, 5, 1, 12);

describe('topup-store ensureSupply', () => {
  beforeEach(() => {
    resetDbForTests();
    resetRepos();
    clearCorpusMemoForTests();
    mockCorpus({
      B2: [
        ['alpha', 'n', 1, 'nghĩa alpha'],
        ['beta', 'n', 2, 'nghĩa beta'],
        ['gamma', 'n', 3, 'nghĩa gamma'],
      ],
      C1: [],
    });
  });

  it('happy path: enriches and writes every picked word', async () => {
    server.use(
      http.post('http://localhost/api/ai/enrich-batch', async ({ request }) => {
        const body = (await request.json()) as { words: string[] };
        return HttpResponse.json({
          items: body.words.map((word) => ({
            word,
            ipa: '',
            partOfSpeech: 'noun',
            meaningVi: `enriched ${word}`,
            exampleSentence: `A sentence about ${word}.`,
            distractors: ['x', 'y', 'z'],
            collocations: [],
            wordFamily: [],
          })),
        });
      }),
    );

    const result = await useTopupStore.getState().ensureSupply({ now: NOW, targetSize: 3 });
    expect(result).toEqual({ added: 3, degraded: false });

    const words = await getRepos().words.list({ limit: 10 });
    expect(words.map((w) => w.word).sort()).toEqual(['alpha', 'beta', 'gamma']);
    const alpha = words.find((w) => w.word === 'alpha')!;
    expect(alpha.meaningVi).toBe('enriched alpha');
    expect(alpha.exampleSentence).toBe('A sentence about alpha.');
    expect(alpha.cefr).toBe('B2');
  });

  it('re-keys by word, tolerating extra/missing/reordered items from the model', async () => {
    server.use(
      http.post('http://localhost/api/ai/enrich-batch', () =>
        HttpResponse.json({
          items: [
            // reordered, missing "beta", plus one extra word never requested
            { word: 'gamma', ipa: '', partOfSpeech: 'noun', meaningVi: 'enriched gamma', exampleSentence: 'S gamma.', distractors: ['a','b','c'], collocations: [], wordFamily: [] },
            { word: 'not-requested', ipa: '', partOfSpeech: 'noun', meaningVi: 'huh', exampleSentence: 'S.', distractors: ['a','b','c'], collocations: [], wordFamily: [] },
            { word: 'alpha', ipa: '', partOfSpeech: 'noun', meaningVi: 'enriched alpha', exampleSentence: 'S alpha.', distractors: ['a','b','c'], collocations: [], wordFamily: [] },
          ],
        }),
      ),
    );

    const result = await useTopupStore.getState().ensureSupply({ now: NOW, targetSize: 3 });
    expect(result.added).toBe(3); // all 3 requested words still get written

    const words = await getRepos().words.list({ limit: 10 });
    expect(words.map((w) => w.word).sort()).toEqual(['alpha', 'beta', 'gamma']);
    expect(words.find((w) => w.word === 'not-requested')).toBeUndefined(); // extra silently dropped

    const alpha = words.find((w) => w.word === 'alpha')!;
    expect(alpha.exampleSentence).toBe('S alpha.'); // enriched
    const beta = words.find((w) => w.word === 'beta')!;
    expect(beta.exampleSentence).toBe(''); // missing from the response -> degraded to the corpus gloss
    expect(beta.meaningVi).toBe('nghĩa beta');
  });

  it('a network failure degrades every picked word to its corpus gloss instead of throwing', async () => {
    server.use(http.post('http://localhost/api/ai/enrich-batch', () => HttpResponse.error()));

    const result = await useTopupStore.getState().ensureSupply({ now: NOW, targetSize: 3 });
    expect(result).toEqual({ added: 3, degraded: true });

    const words = await getRepos().words.list({ limit: 10 });
    expect(words).toHaveLength(3);
    for (const w of words) {
      expect(w.exampleSentence).toBe('');
      expect(w.distractors).toEqual([]);
      expect(w.meaningVi).toMatch(/^nghĩa /); // the corpus gloss, not an AI one
    }
  });

  it('a 429 also degrades gracefully, without retrying (retries: 0)', async () => {
    let calls = 0;
    server.use(
      http.post('http://localhost/api/ai/enrich-batch', () => {
        calls += 1;
        return HttpResponse.json({ error: { code: 'rate_limited', message: 'Quá nhiều yêu cầu' } }, { status: 429 });
      }),
    );

    const result = await useTopupStore.getState().ensureSupply({ now: NOW, targetSize: 3 });
    expect(result.degraded).toBe(true);
    expect(calls).toBe(1); // no client-side retry, same reasoning as work-store.ts
  });

  it('throttles: a second call within 60s is a no-op even with deficit remaining', async () => {
    server.use(
      http.post('http://localhost/api/ai/enrich-batch', () => HttpResponse.error()), // degraded path is fine here
    );

    const first = await useTopupStore.getState().ensureSupply({ now: NOW, targetSize: 5 });
    expect(first.added).toBe(3); // only 3 words exist in the mocked B2 band — deficit of 2 remains

    const second = await useTopupStore.getState().ensureSupply({ now: NOW + 30_000, targetSize: 5 });
    expect(second).toEqual({ added: 0, degraded: false });

    const words = await getRepos().words.list({ limit: 10 });
    expect(words).toHaveLength(3); // unchanged by the throttled second call
  });

  it('is a fast no-op when the notebook already has enough due/fresh words', async () => {
    const words = getRepos().words;
    for (const w of ['one', 'two', 'three']) {
      await words.add({ word: w, source: { kind: 'manual', label: '', at: NOW } });
    }

    const result = await useTopupStore.getState().ensureSupply({ now: NOW, targetSize: 3 });
    expect(result).toEqual({ added: 0, degraded: false });
  });
});
