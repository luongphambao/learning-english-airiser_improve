import { describe, expect, it } from 'vitest';
import { seededShuffle, optionsForWord } from '../shuffle';

describe('lib/text/shuffle', () => {
  it('is deterministic for a given seed key', () => {
    const a = seededShuffle([1, 2, 3, 4], 'seed-1');
    const b = seededShuffle([1, 2, 3, 4], 'seed-1');
    expect(a).toEqual(b);
  });

  it('produces a different order for a different seed key', () => {
    const a = seededShuffle(['a', 'b', 'c', 'd'], 'seed-1');
    const b = seededShuffle(['a', 'b', 'c', 'd'], 'seed-2');
    expect(a).not.toEqual(b);
  });

  it('is a permutation — same elements, same length', () => {
    const input = ['x', 'y', 'z', 'w'];
    const result = seededShuffle(input, 'k');
    expect(result).toHaveLength(input.length);
    expect([...result].sort()).toEqual([...input].sort());
  });

  it('optionsForWord includes the target word among the distractors', () => {
    const options = optionsForWord('w1', 'mitigate', ['exacerbate', 'stimulate', 'provoke']);
    expect(options).toHaveLength(4);
    expect(options).toContain('mitigate');
  });
});
