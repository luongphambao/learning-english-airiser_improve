import { describe, expect, it } from 'vitest';
import { analyzeDocumentTask } from '../tasks/registry.server';
import type { TaskOutput } from '../tasks/contracts';

// Pure repair() logic (docs/decision.md ADR-021) — no network, no provider.
function candidate(overrides: Partial<TaskOutput<'analyzeDocument'>['candidates'][number]> = {}) {
  return {
    word: 'leverage',
    cefr: 'C1' as const,
    category: 'academic' as const,
    meaningVi: 'tận dụng',
    sentenceFromDoc: 'We leverage our network.',
    sentenceSource: 'document' as const,
    distractors: ['exploit', 'utilize', 'apply'],
    ...overrides,
  };
}

describe('analyzeDocumentTask.repair', () => {
  it('caps candidates at MAX_DOC_CANDIDATES (12 per batch — see stores/doc-store.ts for the multi-batch chunking that replaced one 40-candidate whole-document call)', () => {
    const candidates = Array.from({ length: 40 }, (_, i) => candidate({ word: `word${i}` }));
    const { candidates: out } = analyzeDocumentTask.repair!({ candidates });
    expect(out).toHaveLength(12);
  });

  it('dedupes distractors and strips the answer if the model echoed it back', () => {
    const candidates = [candidate({ distractors: ['leverage', 'exploit', 'exploit', 'utilize', 'apply'] })];
    const { candidates: out } = analyzeDocumentTask.repair!({ candidates });
    expect(out[0]!.distractors).toEqual(['exploit', 'utilize', 'apply']);
  });

  it('tolerates fewer than 3 distractors instead of throwing', () => {
    const candidates = [candidate({ distractors: ['exploit'] })];
    const { candidates: out } = analyzeDocumentTask.repair!({ candidates });
    expect(out[0]!.distractors).toEqual(['exploit']);
  });

  it('dedupes candidates by word (case-insensitive), first occurrence wins', () => {
    const candidates = [
      candidate({ word: 'Leverage', meaningVi: 'first' }),
      candidate({ word: 'leverage', meaningVi: 'second' }),
      candidate({ word: 'mitigate', meaningVi: 'third' }),
    ];
    const { candidates: out } = analyzeDocumentTask.repair!({ candidates });
    expect(out.map((c) => c.word)).toEqual(['Leverage', 'mitigate']);
    expect(out[0]!.meaningVi).toBe('first');
  });
});
