import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { resetDbForTests } from '@/lib/db/dexie';
import { resetRepos, getRepos } from '@/lib/repositories';
import { useDocStore } from '../doc-store';

// Same relative-URL-in-Node shim as stores/__tests__/topup-store.test.ts — see its
// comment for why this is needed instead of changing production fetch calls.
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
const DAY_MS = 86_400_000;

function candidate(overrides: Record<string, unknown> = {}) {
  return {
    word: 'leverage',
    cefr: 'C1',
    category: 'academic',
    meaningVi: 'tận dụng',
    sentenceFromDoc: 'We leverage our network.',
    sentenceSource: 'document',
    distractors: ['exploit', 'utilize', 'apply'],
    ...overrides,
  };
}

function mockAnalyzeDoc(candidates: unknown[]) {
  server.use(http.post('http://localhost/api/ai/analyze-doc', () => HttpResponse.json({ candidates })));
}

async function analyzeOnce(candidates: unknown[]) {
  mockAnalyzeDoc(candidates);
  await useDocStore.getState().analyze({
    units: ['Document text.'],
    unitLabel: 'part',
    fileName: 'doc.txt',
    kind: 'text',
    level: 'B2',
    contextTopic: 'general',
      goal: '',
  });
}

describe('doc-store', () => {
  beforeEach(() => {
    resetDbForTests();
    resetRepos();
    useDocStore.getState().reset();
  });

  it('analyze(): fetches candidates, defaults triage to null, and persists them on the import row', async () => {
    await analyzeOnce([candidate()]);
    const state = useDocStore.getState();
    expect(state.status).toBe('ready');
    expect(state.candidates).toHaveLength(1);
    expect(state.candidates[0]!.word).toBe('leverage');
    expect(state.candidates[0]!.triage).toBeNull();

    const imp = await getRepos().imports.get(state.importId!);
    expect(imp?.status).toBe('ready');
    expect(imp?.candidates).toHaveLength(1);
  });

  it('analyze(): a server error moves the import to failed and records the problem code as a translatable key', async () => {
    server.use(
      http.post('http://localhost/api/ai/analyze-doc', () =>
        HttpResponse.json(
          { error: { code: 'upstream_unavailable', message: 'Dịch vụ AI tạm thời không phản hồi. Thử lại sau.' } },
          { status: 502 },
        ),
      ),
    );
    await useDocStore.getState().analyze({
      units: ['Document text.'],
      unitLabel: 'part',
      fileName: 'doc.txt',
      kind: 'text',
      level: 'B2',
      contextTopic: 'general',
      goal: '',
    });

    const state = useDocStore.getState();
    expect(state.status).toBe('error');
    // The server's problem CODE, as a marked i18n key — not its Vietnamese sentence,
    // which would freeze this message in one language on the persisted import row.
    expect(state.errorKey).toBe('@apiError.upstream_unavailable');

    const imp = await getRepos().imports.get(state.importId!);
    expect(imp?.status).toBe('failed');
  });

  it("saveTriage(): 'known' writes only to skipped, never the notebook", async () => {
    await analyzeOnce([candidate({ word: 'alpha' })]);
    const result = await useDocStore.getState().saveTriage({ alpha: 'known' }, NOW);
    expect(result).toEqual({ added: 0, skipped: 1 });

    expect(await getRepos().skipped.has('alpha')).toBe(true);
    expect(await getRepos().words.list({ limit: 10 })).toHaveLength(0);
  });

  it("saveTriage(): 'partial' schedules easeLevel 2 / dueAt = now + 3 days", async () => {
    await analyzeOnce([candidate({ word: 'beta' })]);
    await useDocStore.getState().saveTriage({ beta: 'partial' }, NOW);

    const word = await getRepos().words.getByWord('beta');
    expect(word?.easeLevel).toBe(2);
    expect(word?.dueAt).toBe(NOW + 3 * DAY_MS);
  });

  it("saveTriage(): 'unknown' schedules easeLevel 0 / dueAt = now, carrying the document's sentence + distractors", async () => {
    await analyzeOnce([candidate({ word: 'gamma' })]);
    await useDocStore.getState().saveTriage({ gamma: 'unknown' }, NOW);

    const word = await getRepos().words.getByWord('gamma');
    expect(word?.easeLevel).toBe(0);
    expect(word?.dueAt).toBe(NOW);
    expect(word?.exampleSentence).toBe('We leverage our network.');
    expect(word?.distractors).toEqual(['exploit', 'utilize', 'apply']);
  });

  it('saveTriage(): complete() count excludes known candidates, and setTriage persists every choice for reopening', async () => {
    await analyzeOnce([candidate({ word: 'alpha' }), candidate({ word: 'beta' }), candidate({ word: 'gamma' })]);
    const importId = useDocStore.getState().importId!;

    const result = await useDocStore.getState().saveTriage({ alpha: 'known', beta: 'partial', gamma: 'unknown' }, NOW);
    expect(result).toEqual({ added: 2, skipped: 1 });

    const imp = await getRepos().imports.get(importId);
    expect(imp?.status).toBe('done');
    expect(imp?.addedCount).toBe(2);
    expect(imp?.candidates.map((c) => [c.word, c.triage])).toEqual([
      ['alpha', 'known'],
      ['beta', 'partial'],
      ['gamma', 'unknown'],
    ]);
    expect(useDocStore.getState().status).toBe('done');
  });

  it('analyze(): chunks multiple large units into concurrent batches and aggregates candidates from all of them', async () => {
    const bigUnit1 = 'UNIT_ONE '.repeat(500); // ~4500 chars — two of these exceed the ~6000 char batch cap
    const bigUnit2 = 'UNIT_TWO '.repeat(500);
    server.use(
      http.post('http://localhost/api/ai/analyze-doc', async ({ request }) => {
        const body = (await request.json()) as { documentText: string };
        const candidates = body.documentText.includes('UNIT_ONE')
          ? [candidate({ word: 'alpha' })]
          : [candidate({ word: 'beta' })];
        return HttpResponse.json({ candidates });
      }),
    );

    await useDocStore.getState().analyze({
      units: [bigUnit1, bigUnit2],
      unitLabel: 'page',
      fileName: 'doc.pdf',
      kind: 'pdf',
      level: 'B2',
      contextTopic: 'general',
      goal: '',
    });

    const state = useDocStore.getState();
    expect(state.status).toBe('ready');
    expect(state.candidates.map((c) => c.word).sort()).toEqual(['alpha', 'beta']);
  });

  it('analyze(): dedupes a candidate suggested by more than one concurrent batch, first chunk order wins', async () => {
    const bigUnit1 = 'UNIT_ONE '.repeat(500);
    const bigUnit2 = 'UNIT_TWO '.repeat(500);
    server.use(
      http.post('http://localhost/api/ai/analyze-doc', async ({ request }) => {
        const body = (await request.json()) as { documentText: string };
        const meaningVi = body.documentText.includes('UNIT_ONE') ? 'first' : 'second';
        return HttpResponse.json({ candidates: [candidate({ word: 'shared', meaningVi })] });
      }),
    );

    await useDocStore.getState().analyze({
      units: [bigUnit1, bigUnit2],
      unitLabel: 'page',
      fileName: 'doc.pdf',
      kind: 'pdf',
      level: 'B2',
      contextTopic: 'general',
      goal: '',
    });

    const state = useDocStore.getState();
    expect(state.candidates).toHaveLength(1);
    expect(state.candidates[0]!.meaningVi).toBe('first');
  });

  it('analyze(): a mid-way batch failure sets degraded=true but keeps candidates from batches that succeeded', async () => {
    const bigUnit1 = 'UNIT_ONE '.repeat(500);
    const bigUnit2 = 'UNIT_TWO '.repeat(500);
    server.use(
      http.post('http://localhost/api/ai/analyze-doc', async ({ request }) => {
        const body = (await request.json()) as { documentText: string };
        if (body.documentText.includes('UNIT_TWO')) {
          return HttpResponse.json({ error: { code: 'upstream_unavailable', message: 'lỗi' } }, { status: 502 });
        }
        return HttpResponse.json({ candidates: [candidate({ word: 'alpha' })] });
      }),
    );

    await useDocStore.getState().analyze({
      units: [bigUnit1, bigUnit2],
      unitLabel: 'page',
      fileName: 'doc.pdf',
      kind: 'pdf',
      level: 'B2',
      contextTopic: 'general',
      goal: '',
    });

    const state = useDocStore.getState();
    expect(state.status).toBe('ready');
    expect(state.degraded).toBe(true);
    expect(state.candidates.map((c) => c.word)).toEqual(['alpha']);
  });

  it('analyze(): caps total units at 20 and reports truncatedAtUnit', async () => {
    mockAnalyzeDoc([]);
    const units = Array.from({ length: 25 }, (_, i) => `Page ${i + 1} content.`);

    await useDocStore.getState().analyze({
      units,
      unitLabel: 'page',
      fileName: 'doc.pdf',
      kind: 'pdf',
      level: 'B2',
      contextTopic: 'general',
      goal: '',
    });

    expect(useDocStore.getState().truncatedAtUnit).toBe(20);
  });

  it('open(): reloads a past import into state, including its saved triage', async () => {
    await analyzeOnce([candidate({ word: 'delta' })]);
    const importId = useDocStore.getState().importId!;
    await useDocStore.getState().saveTriage({ delta: 'partial' }, NOW);

    useDocStore.getState().reset();
    expect(useDocStore.getState().status).toBe('idle');

    await useDocStore.getState().open(importId);
    const state = useDocStore.getState();
    expect(state.status).toBe('done');
    expect(state.candidates[0]!.triage).toBe('partial');
  });
});
