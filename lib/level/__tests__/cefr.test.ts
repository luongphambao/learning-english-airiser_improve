import { describe, expect, it } from 'vitest';
import { cefrFromRank, cefrIndex, clampCefr, knownCefr, stepCefr } from '../cefr';

describe('cefrIndex / clampCefr / stepCefr', () => {
  it('cefrIndex matches CEFR_ORDER position', () => {
    expect(cefrIndex('A1')).toBe(0);
    expect(cefrIndex('C2')).toBe(5);
  });

  it('clampCefr never goes below A1 or above C2', () => {
    expect(clampCefr(-5)).toBe('A1');
    expect(clampCefr(0)).toBe('A1');
    expect(clampCefr(5)).toBe('C2');
    expect(clampCefr(99)).toBe('C2');
  });

  it('stepCefr moves by delta and clamps at both ends', () => {
    expect(stepCefr('B2', 1)).toBe('C1');
    expect(stepCefr('B2', -1)).toBe('B1');
    expect(stepCefr('C2', 1)).toBe('C2'); // clamped at the top
    expect(stepCefr('A1', -1)).toBe('A1'); // clamped at the bottom
  });
});

describe('knownCefr', () => {
  it('collapses undefined and "unknown" to null', () => {
    expect(knownCefr(undefined)).toBeNull();
    expect(knownCefr('unknown')).toBeNull();
  });

  it('passes a real band through unchanged', () => {
    expect(knownCefr('B2')).toBe('B2');
  });
});

describe('cefrFromRank', () => {
  it('bands NGSL by rank thresholds', () => {
    expect(cefrFromRank(1, 'ngsl')).toBe('A2');
    expect(cefrFromRank(600, 'ngsl')).toBe('A2');
    expect(cefrFromRank(601, 'ngsl')).toBe('B1');
    expect(cefrFromRank(1400, 'ngsl')).toBe('B1');
    expect(cefrFromRank(1401, 'ngsl')).toBe('B2');
  });

  it('bands BSL by a single split', () => {
    expect(cefrFromRank(1, 'bsl')).toBe('B1');
    expect(cefrFromRank(600, 'bsl')).toBe('B1');
    expect(cefrFromRank(601, 'bsl')).toBe('B2');
  });

  it('always bands NAWL as C1', () => {
    expect(cefrFromRank(1, 'nawl')).toBe('C1');
    expect(cefrFromRank(963, 'nawl')).toBe('C1');
  });
});
