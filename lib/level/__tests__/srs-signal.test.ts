import { describe, expect, it } from 'vitest';
import { inferLevelFromReviews, type ReviewSample } from '../srs-signal';

const NOW = Date.UTC(2026, 5, 1);

function samples(cefr: ReviewSample['cefr'], total: number, correct: number): ReviewSample[] {
  return [
    ...Array.from({ length: correct }, () => ({ cefr, correct: true })),
    ...Array.from({ length: total - correct }, () => ({ cefr, correct: false })),
  ];
}

describe('inferLevelFromReviews', () => {
  it('returns null below the 20-review floor, regardless of accuracy', () => {
    expect(inferLevelFromReviews(samples('B2', 15, 15), NOW)).toBeNull();
  });

  it('returns null when no single band clears 10 samples at 70% accuracy', () => {
    const mixed = [...samples('A2', 10, 5), ...samples('B1', 10, 6)]; // 50%/60%, neither clears 70%
    expect(inferLevelFromReviews(mixed, NOW)).toBeNull();
  });

  it('picks the highest band clearing the accuracy threshold', () => {
    const mixed = [...samples('A2', 10, 10), ...samples('B2', 10, 8)]; // 100%, 80% — both clear 70%
    const result = inferLevelFromReviews(mixed, NOW);
    expect(result?.level).toBe('B2');
  });

  it('does not count a band with fewer than 10 samples even at perfect accuracy', () => {
    const mixed = [...samples('A2', 15, 15), ...samples('C1', 5, 5)]; // C1 only has 5 samples
    const result = inferLevelFromReviews(mixed, NOW);
    expect(result?.level).toBe('A2');
  });

  it('weight scales with total review volume, capped at 3', () => {
    expect(inferLevelFromReviews(samples('B2', 20, 20), NOW)?.weight).toBe(1);
    expect(inferLevelFromReviews(samples('B2', 40, 40), NOW)?.weight).toBe(2);
    expect(inferLevelFromReviews(samples('B2', 100, 100), NOW)?.weight).toBe(3);
  });

  it('stamps the signal with the caller-supplied `now`', () => {
    expect(inferLevelFromReviews(samples('B2', 20, 20), NOW)?.at).toBe(NOW);
  });
});
