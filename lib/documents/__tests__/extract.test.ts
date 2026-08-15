import { describe, expect, it } from 'vitest';
import { chunkUnits, hasEnoughText, normalizeExtractedText, splitIntoUnits } from '../extract';

describe('normalizeExtractedText', () => {
  it('rejoins a word hyphenated across a line break', () => {
    expect(normalizeExtractedText('This is a lever-\nage point.')).toBe('This is a leverage point.');
  });

  it('collapses mid-sentence line breaks into a single space', () => {
    expect(normalizeExtractedText('First line\nsecond line\nthird line')).toBe('First line second line third line');
  });

  it('collapses repeated whitespace from positioned pdf.js fragments', () => {
    expect(normalizeExtractedText('word1   word2\t\tword3')).toBe('word1 word2 word3');
  });

  it('trims leading/trailing whitespace', () => {
    expect(normalizeExtractedText('  \n hello \n ')).toBe('hello');
  });
});

describe('hasEnoughText', () => {
  it('rejects near-empty text (scanned/image-only PDF)', () => {
    expect(hasEnoughText('')).toBe(false);
    expect(hasEnoughText('   \n\n  ')).toBe(false);
    expect(hasEnoughText('a few words only')).toBe(false);
  });

  it('accepts text at or above the threshold', () => {
    expect(hasEnoughText('x'.repeat(200))).toBe(true);
    expect(hasEnoughText('x'.repeat(199))).toBe(false);
  });
});

describe('splitIntoUnits', () => {
  it('splits on blank-line paragraph breaks', () => {
    expect(splitIntoUnits('First para.\n\nSecond para.\n\nThird para.')).toEqual([
      'First para.',
      'Second para.',
      'Third para.',
    ]);
  });

  it('splits an oversized paragraph on sentence boundaries instead of returning it whole', () => {
    const long = 'One sentence here. ' + 'Another one right after. '.repeat(10);
    const units = splitIntoUnits(long, 100);
    expect(units.length).toBeGreaterThan(1);
    for (const u of units) expect(u.length).toBeLessThanOrEqual(100 + 30); // sentence-boundary slack
  });

  it('falls back to the whole trimmed text as one unit when there are no paragraph breaks', () => {
    expect(splitIntoUnits('  just one short line  ', 1200)).toEqual(['just one short line']);
  });

  it('returns an empty array for empty/whitespace-only input', () => {
    expect(splitIntoUnits('')).toEqual([]);
    expect(splitIntoUnits('   \n\n  ')).toEqual([]);
  });
});

describe('chunkUnits', () => {
  it('packs consecutive units into a chunk until adding the next would exceed the cap', () => {
    const { chunks, truncatedAtUnit } = chunkUnits(['aaaa', 'bbbb', 'cccc'], 10, 20);
    expect(truncatedAtUnit).toBeNull();
    // 'aaaa' + '\n\n' + 'bbbb' = 10 chars, exactly at the cap; adding 'cccc' would exceed it
    expect(chunks).toEqual([
      { text: 'aaaa\n\nbbbb', fromUnit: 1, toUnit: 2 },
      { text: 'cccc', fromUnit: 3, toUnit: 3 },
    ]);
  });

  it('never splits a single unit apart, even if it alone exceeds the cap', () => {
    const { chunks } = chunkUnits(['this one page is longer than the cap'], 10, 20);
    expect(chunks).toEqual([{ text: 'this one page is longer than the cap', fromUnit: 1, toUnit: 1 }]);
  });

  it('caps total units considered and reports where it stopped', () => {
    const units = Array.from({ length: 30 }, (_, i) => `page${i + 1}`);
    const { chunks, truncatedAtUnit } = chunkUnits(units, 1000, 20);
    expect(truncatedAtUnit).toBe(20);
    const lastChunk = chunks[chunks.length - 1]!;
    expect(lastChunk.toUnit).toBe(20);
  });

  it('returns no chunks for an empty units array', () => {
    expect(chunkUnits([], 1000, 20)).toEqual({ chunks: [], truncatedAtUnit: null });
  });
});
