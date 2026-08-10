import { describe, expect, it } from 'vitest';
import { splitForBlank } from '../blank';

describe('lib/text/blank splitForBlank', () => {
  it('handles a hyphenated word ("trade-off") that used to crash the unescaped regex', () => {
    const result = splitForBlank('Engineering requires a trade-off between speed and safety.', 'trade-off');
    expect(result).not.toBeNull();
    expect(result?.match).toBe('trade-off');
    expect(result?.before).toBe('Engineering requires a ');
    expect(result?.after).toBe(' between speed and safety.');
  });

  it('handles a word containing regex metacharacters ("C++") without throwing', () => {
    expect(() => splitForBlank('We rewrote the module in C++ last year.', 'C++')).not.toThrow();
    const result = splitForBlank('We rewrote the module in C++ last year.', 'C++');
    expect(result?.match).toBe('C++');
  });

  it('handles a multi-word phrasal entry', () => {
    const result = splitForBlank('Do not run into the same bug twice.', 'run into');
    expect(result?.match).toBe('run into');
  });

  it('matches case-insensitively but preserves the original casing in the split', () => {
    const result = splitForBlank('Deprecate the old endpoint soon.', 'deprecate');
    expect(result?.match).toBe('Deprecate');
  });

  it('returns null when the word is absent from the sentence', () => {
    expect(splitForBlank('This sentence has nothing to do with it.', 'mitigate')).toBeNull();
  });

  it('returns null for empty sentence or word', () => {
    expect(splitForBlank('', 'word')).toBeNull();
    expect(splitForBlank('A sentence.', '')).toBeNull();
  });

  it('matches only the first occurrence when the word appears twice', () => {
    const result = splitForBlank('mitigate risk, then mitigate impact.', 'mitigate');
    expect(result?.before).toBe('');
    expect(result?.after).toBe(' risk, then mitigate impact.');
  });
});
