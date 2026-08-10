import type { Word } from '@/lib/domain';

// IndexedDB (and therefore Dexie's `.where()`) cannot index a boolean column, and a
// compound index needs a plain lowercase string to dedupe "is this word already in
// the notebook" in O(log n) instead of the old `words.find()` linear scan (audit #13).
// So the persisted row shape differs slightly from the domain `Word` type — this file
// is the only place that translates between them. See docs/data-model.md §2.
export interface WordRow extends Omit<Word, 'isLeech' | 'consecutiveCorrect' | 'updatedAt' | 'deletedAt'> {
  isLeech: 0 | 1;
  wordLower: string;
  consecutiveCorrect: number;
  updatedAt: number;
  deletedAt: number | null;
}

export function toRow(word: Word, now: number): WordRow {
  return {
    ...word,
    isLeech: word.isLeech ? 1 : 0,
    wordLower: word.word.toLowerCase(),
    consecutiveCorrect: word.consecutiveCorrect ?? 0,
    updatedAt: word.updatedAt ?? now,
    deletedAt: word.deletedAt ?? null,
  };
}

export function fromRow(row: WordRow): Word {
  return {
    ...row,
    isLeech: row.isLeech === 1,
  };
}
