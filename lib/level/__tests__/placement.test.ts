import { describe, expect, it } from 'vitest';
import { buildPlacementItems, scorePlacement, type PlacementAnswer } from '../placement';
import type { CorpusEntry } from '@/lib/corpus/types';

function band(word: string, rank: number, cefr: CorpusEntry['band']): CorpusEntry {
  return { word, pos: 'n', rank, vi: `nghĩa ${word}`, band: cefr };
}

describe('buildPlacementItems', () => {
  it('interleaves bands instead of grouping low-to-high, and never includes A1', () => {
    const entries = {
      A2: [band('a2-1', 1, 'A2')],
      B1: [band('b1-1', 1, 'B1')],
      B2: [band('b2-1', 1, 'B2')],
      C1: [band('c1-1', 1, 'C1')],
      C2: [band('c2-1', 1, 'C2')],
    };
    const items = buildPlacementItems(entries, 1);
    expect(items.map((i) => i.cefr)).toEqual(['A2', 'B1', 'B2', 'C1', 'C2']);
    expect(items.some((i) => i.cefr === ('A1' as never))).toBe(false);
  });

  it('is deterministic and picks the lowest-rank words first within a band', () => {
    const entries = { B2: [band('high-rank', 9, 'B2'), band('low-rank', 1, 'B2')] };
    const items = buildPlacementItems(entries, 1);
    expect(items.map((i) => i.word)).toEqual(['low-rank']);
  });

  it('skips a band with fewer entries than perBand without crashing', () => {
    const entries = { A2: [band('only', 1, 'A2')] };
    const items = buildPlacementItems(entries, 4);
    expect(items).toEqual([{ word: 'only', vi: 'nghĩa only', cefr: 'A2' }]);
  });
});

function allKnown(cefr: PlacementAnswer['cefr'], n: number): PlacementAnswer[] {
  return Array.from({ length: n }, () => ({ cefr, known: true }));
}
function noneKnown(cefr: PlacementAnswer['cefr'], n: number): PlacementAnswer[] {
  return Array.from({ length: n }, () => ({ cefr, known: false }));
}

describe('scorePlacement', () => {
  it('knowing every band scores C2 with high confidence', () => {
    const items = [...allKnown('A2', 4), ...allKnown('B1', 4), ...allKnown('B2', 4), ...allKnown('C1', 4), ...allKnown('C2', 4)];
    const result = scorePlacement(items);
    expect(result.level).toBe('C2');
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it('knowing nothing floors at A2, never A1', () => {
    const items = [...noneKnown('A2', 4), ...noneKnown('B1', 4), ...noneKnown('B2', 4)];
    const result = scorePlacement(items);
    expect(result.level).toBe('A2');
  });

  it('a clean cutoff (knows A2+B1, not B2+) scores that cutoff band', () => {
    const items = [...allKnown('A2', 4), ...allKnown('B1', 4), ...noneKnown('B2', 4), ...noneKnown('C1', 4)];
    const result = scorePlacement(items);
    expect(result.level).toBe('B1');
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it('a non-monotonic result (knows C1 but not B1) falls back to a weighted mean with low confidence', () => {
    const items: PlacementAnswer[] = [...allKnown('A2', 4), ...noneKnown('B1', 4), ...allKnown('C1', 4)];
    const result = scorePlacement(items);
    // Should NOT naively trust the A2 cutoff as if C1 evidence didn't exist.
    expect(result.level).not.toBe('A2');
    expect(result.confidence).toBeLessThan(0.5);
  });

  it('fewer than 12 answered items yields low confidence even with a clean cutoff', () => {
    const items = [...allKnown('A2', 4), ...allKnown('B1', 2)]; // 6 total
    const result = scorePlacement(items);
    expect(result.confidence).toBeLessThan(0.5);
  });

  it('an empty answer set returns the A2 floor with minimal confidence', () => {
    const result = scorePlacement([]);
    expect(result.level).toBe('A2');
    expect(result.confidence).toBeLessThan(0.3);
  });
});
