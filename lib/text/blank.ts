export interface BlankSplit {
  before: string;
  match: string; // exact substring matched — preserves original casing
  after: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Locates the target word inside its example sentence so a fill-blank exercise can
 * replace it with a ruled blank. The old ExerciseFillBlank.tsx built this with
 * `new RegExp('(' + word.word + ')', 'gi')` — completely unescaped, so any word
 * containing a regex metacharacter crashed the exercise. The app's own seed word
 * "trade-off" already has one (`-` inside a character-adjacent position isn't
 * special on its own, but `(`, `)`, `+`, `*`, `?`, `.` all are, and a phrasal entry
 * like "run (a) risk" or a word like "C++" would throw a SyntaxError outright).
 * Returns null (no crash) when the word isn't found in the sentence at all.
 */
export function splitForBlank(sentence: string, word: string): BlankSplit | null {
  if (!sentence || !word) return null;
  const pattern = new RegExp(escapeRegExp(word), 'i');
  const match = pattern.exec(sentence);
  if (!match) return null;

  const start = match.index;
  const end = start + match[0].length;
  return {
    before: sentence.slice(0, start),
    match: sentence.slice(start, end),
    after: sentence.slice(end),
  };
}
