import { describe, expect, it } from 'vitest';
import { pickCorpusWords } from '../pick';
import type { CorpusEntry } from '../types';

function entry(word: string, rank: number, band: CorpusEntry['band'] = 'B2'): CorpusEntry {
  return { word, pos: 'n', rank, vi: `nghĩa của ${word}`, band };
}

describe('pickCorpusWords', () => {
  it('returns [] for a non-positive count without touching entries', () => {
    expect(pickCorpusWords({ entries: {}, level: 'B2', exclude: new Set(), count: 0 })).toEqual([]);
  });

  it('picks ~70% from level and ~30% from level+1, sorted by rank ascending', () => {
    const b2 = [entry('c', 3), entry('a', 1), entry('b', 2), entry('d', 4)]; // deliberately unsorted
    const c1 = [entry('y', 2, 'C1'), entry('x', 1, 'C1')];

    const picked = pickCorpusWords({ entries: { B2: b2, C1: c1 }, level: 'B2', exclude: new Set(), count: 4 });

    // ceil(4*0.7)=3 from B2 (lowest rank first), 1 from C1
    expect(picked.map((e) => e.word)).toEqual(['a', 'b', 'c', 'x']);
  });

  it('never reaches below `level` — no A2/B1 words when level is B2', () => {
    const picked = pickCorpusWords({
      entries: { A2: [entry('easy', 1, 'A2')], B1: [entry('mid', 1, 'B1')], B2: [entry('at-level', 1)] },
      level: 'B2',
      exclude: new Set(),
      count: 5,
    });
    expect(picked.map((e) => e.word)).toEqual(['at-level']);
  });

  it('excludes words already in the notebook or skipped list, case-insensitively', () => {
    const b2 = [entry('Mitigate', 1), entry('leverage', 2)];
    const picked = pickCorpusWords({
      entries: { B2: b2 },
      level: 'B2',
      exclude: new Set(['mitigate']),
      count: 5,
    });
    expect(picked.map((e) => e.word)).toEqual(['leverage']);
  });

  it('is deterministic — the same input always produces the same output', () => {
    const b2 = [entry('a', 1), entry('b', 2), entry('c', 3)];
    const first = pickCorpusWords({ entries: { B2: b2 }, level: 'B2', exclude: new Set(), count: 2 });
    const second = pickCorpusWords({ entries: { B2: b2 }, level: 'B2', exclude: new Set(), count: 2 });
    expect(first).toEqual(second);
  });

  it('backfills from `level` when `level`+1 has fewer eligible words than its share, without exceeding count', () => {
    const b2 = Array.from({ length: 5 }, (_, i) => entry(`w${i}`, i + 1));
    const picked = pickCorpusWords({ entries: { B2: b2, C1: [] }, level: 'B2', exclude: new Set(), count: 5 });
    expect(picked).toHaveLength(5);
    expect(picked.map((e) => e.word)).toEqual(['w0', 'w1', 'w2', 'w3', 'w4']);
  });

  it('returns fewer than count when the pool genuinely runs out, without crashing', () => {
    const picked = pickCorpusWords({ entries: { B2: [entry('only', 1)] }, level: 'B2', exclude: new Set(), count: 5 });
    expect(picked).toEqual([entry('only', 1)]);
  });

  it('is a no-op on C2 (no level+1 band exists) and still returns level words', () => {
    const c2 = [entry('rarest', 1, 'C2'), entry('rarer', 2, 'C2')];
    const picked = pickCorpusWords({ entries: { C2: c2 }, level: 'C2', exclude: new Set(), count: 2 });
    expect(picked.map((e) => e.word)).toEqual(['rarest', 'rarer']);
  });
});
