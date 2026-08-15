import type { CefrOrUnknown, EntryType, Word } from '@/lib/domain';

// IndexedDB (and therefore Dexie's `.where()`) cannot index a boolean column, and a
// compound index needs a plain lowercase string to dedupe "is this word already in
// the notebook" in O(log n) instead of the old `words.find()` linear scan (audit #13).
// So the persisted row shape differs slightly from the domain `Word` type — this file
// is the only place that translates between them. See docs/data-model.md §2.
export interface WordRow
  extends Omit<Word, 'isLeech' | 'consecutiveCorrect' | 'updatedAt' | 'deletedAt' | 'entryType' | 'noteVi' | 'originalText'> {
  isLeech: 0 | 1;
  wordLower: string;
  consecutiveCorrect: number;
  updatedAt: number;
  deletedAt: number | null;
  // v3 (docs/decision.md ADR-014) — concrete here (never undefined) so `entryType`
  // is indexable (IndexedDB drops a record from an index entirely if its key path
  // is undefined — see the v3 comment in lib/db/dexie.ts) and every reader gets a
  // real value without an `?? 'word'` at every call site.
  entryType: EntryType;
  noteVi: string;
  originalText: string | null;
  // v4 (docs/decision.md ADR-016) — concrete here for the same reason as entryType
  // above: 'unknown' rather than undefined, so `cefr` and `[cefr+status]` never drop
  // a row from their index.
  cefr: CefrOrUnknown;
}

export function toRow(word: Word, now: number): WordRow {
  return {
    ...word,
    isLeech: word.isLeech ? 1 : 0,
    wordLower: word.word.toLowerCase(),
    consecutiveCorrect: word.consecutiveCorrect ?? 0,
    updatedAt: word.updatedAt ?? now,
    deletedAt: word.deletedAt ?? null,
    entryType: word.entryType ?? 'word',
    noteVi: word.noteVi ?? '',
    originalText: word.originalText ?? null,
    cefr: word.cefr ?? 'unknown',
  };
}

export function fromRow(row: WordRow): Word {
  return {
    ...row,
    isLeech: row.isLeech === 1,
  };
}
