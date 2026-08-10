// Deterministic seeded shuffle — extracted from the byte-identical copy that used to
// live in both components/ExerciseFillBlank.tsx and components/ExerciseListen.tsx
// (docs/progress/00-baseline-audit.md #8). The algorithm is deliberately kept
// exactly as-is: it exists to give the same option order on the server render and
// the client hydration for a given (word, seedKey) pair, which a plain
// `Math.random()` shuffle cannot do without a hydration mismatch.
function seedFromString(key: string): number {
  let seed = 0;
  for (let i = 0; i < key.length; i++) {
    seed = (seed << 5) - seed + key.charCodeAt(i);
    seed |= 0;
  }
  return seed;
}

export function seededShuffle<T>(items: readonly T[], seedKey: string): T[] {
  let seed = seedFromString(seedKey);
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    seed = (seed * 9301 + 49297) % 233280;
    const rnd = Math.abs(seed) / 233280;
    const j = Math.floor(rnd * (i + 1));
    const a = result[i]!;
    const b = result[j]!;
    result[i] = b;
    result[j] = a;
  }
  return result;
}

/** The 4-option MCQ list for a fill-blank/listen exercise: target word + its
 * distractors, in a stable per-word order. */
export function optionsForWord(wordId: string, word: string, distractors: readonly string[]): string[] {
  return seededShuffle([word, ...distractors], `${wordId}_${word}`);
}
