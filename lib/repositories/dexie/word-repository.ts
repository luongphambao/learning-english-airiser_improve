import Dexie from 'dexie';
import { getDb } from '@/lib/db/dexie';
import { newId } from '@/lib/db/ids';
import { fromRow, toRow, type WordRow } from '@/lib/db/rows';
import { safeParseRow, quarantineRow } from '@/lib/db/read';
import { WordSchema, type Word, type WordStatus } from '@/lib/domain';
import { applyTriage } from '@/lib/srs/schedule';
import type { ListWordsQuery, NewInsightWordInput, NewWordInput, WordRepository } from '../types';

async function readRows(rows: WordRow[]): Promise<Word[]> {
  const db = getDb();
  const out: Word[] = [];
  for (const row of rows) {
    // Validate the DOMAIN shape (post fromRow conversion), not the raw row — the
    // row's `isLeech` is 0|1 (IndexedDB can't index booleans, see lib/db/rows.ts)
    // and would otherwise fail WordSchema, which expects a real boolean.
    const domain = fromRow(row);
    const result = safeParseRow(WordSchema, domain);
    if (result.ok) {
      out.push(result.value);
    } else {
      await quarantineRow(db, 'words', row.id, row, result.issues);
    }
  }
  return out;
}

async function addWord(input: NewWordInput): Promise<Word> {
  const db = getDb();
  const now = Date.now();
  const wordLower = input.word.toLowerCase();

  // &wordLower is a unique index. Rather than attempt an insert and react to the
  // ConstraintError it would throw, check-then-write inside one transaction — this
  // is atomic (no other writer can interleave) and doesn't depend on how a given
  // IndexedDB implementation surfaces constraint failures (see docs/progress —
  // this replaced an add()-then-catch version that fake-indexeddb didn't raise the
  // way the browser does). Also fixes audit #13: a duplicate add() now visibly
  // returns the existing word instead of silently closing the sheet.
  return db.transaction('rw', db.words, async () => {
    const existingRow = await db.words.where('wordLower').equals(wordLower).first();
    if (existingRow) {
      if (existingRow.deletedAt) {
        const resurrected = { ...existingRow, deletedAt: null, updatedAt: now };
        await db.words.put(resurrected);
        const [w] = await readRows([resurrected]);
        if (w) return w;
      } else {
        const [w] = await readRows([existingRow]);
        if (w) return w;
      }
    }

    const draft: Word = {
      id: newId('w_'),
      word: input.word,
      ipa: '',
      partOfSpeech: '',
      meaningVi: '',
      exampleSentence: '',
      distractors: [],
      collocations: [],
      wordFamily: [],
      source: input.source,
      audioUrl: null,
      createdAt: now,
      dueAt: now,
      easeLevel: 0,
      reviewCount: 0,
      lapseCount: 0,
      consecutiveCorrect: 0,
      isLeech: false,
      status: 'new',
      updatedAt: now,
      deletedAt: null,
    };
    await db.words.put(toRow(draft, now));
    return draft;
  });
}

async function addFromInsight(input: NewInsightWordInput): Promise<Word> {
  const db = getDb();
  const wordLower = input.text.toLowerCase();

  // Same check-then-write-in-one-transaction pattern as addWord() above, against
  // the same &wordLower unique index — a phrase and a plain word share one
  // namespace on purpose (docs/decision.md ADR-014): "extend the deadline" saved
  // once from Learn and once from a plain paste must still be one row, not two.
  return db.transaction('rw', db.words, async () => {
    const existingRow = await db.words.where('wordLower').equals(wordLower).first();
    if (existingRow) {
      const current = fromRow(existingRow);
      const updated: Word = {
        ...current,
        // Content refreshes to the newest AI output...
        meaningVi: input.meaningVi,
        exampleSentence: input.exampleSentence,
        distractors: input.distractors,
        entryType: input.entryType,
        noteVi: input.noteVi,
        originalText: input.originalText,
        updatedAt: input.now,
        deletedAt: null, // resurrect if it had been soft-deleted
        // ...but SRS state does NOT reset — re-saving something already being
        // practiced must not throw away its progress. current.* already carries
        // dueAt/easeLevel/reviewCount/lapseCount/isLeech/status/consecutiveCorrect
        // forward via the spread above; this comment exists so a future edit
        // doesn't "simplify" that away.
      };
      await db.words.put(toRow(updated, input.now));
      return updated;
    }

    const schedule = applyTriage('unknown', input.now)!; // 'unknown' never returns null
    const draft: Word = {
      id: newId('w_'),
      word: input.text,
      ipa: '',
      partOfSpeech: '',
      meaningVi: input.meaningVi,
      exampleSentence: input.exampleSentence,
      distractors: input.distractors,
      collocations: [],
      wordFamily: [],
      source: input.source,
      audioUrl: null,
      createdAt: input.now,
      dueAt: schedule.dueAt,
      easeLevel: schedule.easeLevel,
      reviewCount: schedule.reviewCount,
      lapseCount: schedule.lapseCount,
      consecutiveCorrect: schedule.consecutiveCorrect,
      isLeech: schedule.isLeech,
      status: schedule.status,
      updatedAt: input.now,
      deletedAt: null,
      entryType: input.entryType,
      noteVi: input.noteVi,
      originalText: input.originalText,
    };
    await db.words.put(toRow(draft, input.now));
    return draft;
  });
}

export function createDexieWordRepository(): WordRepository {
  const db = getDb();

  return {
    async get(id) {
      const row = await db.words.get(id);
      if (!row || row.deletedAt) return null;
      const [word] = await readRows([row]);
      return word ?? null;
    },

    async getByWord(word) {
      const row = await db.words.where('wordLower').equals(word.toLowerCase()).first();
      if (!row || row.deletedAt) return null;
      const [w] = await readRows([row]);
      return w ?? null;
    },

    async list(query: ListWordsQuery) {
      const collection = query.status
        ? db.words.where('status').equals(query.status)
        : db.words.orderBy('createdAt');
      let rows = await collection.toArray();
      rows = rows.filter((r) => !r.deletedAt);
      if (query.entryType) {
        rows = rows.filter((r) => r.entryType === query.entryType);
      }
      if (query.search) {
        const needle = query.search.toLowerCase();
        rows = rows.filter(
          (r) => r.word.toLowerCase().includes(needle) || r.meaningVi.toLowerCase().includes(needle),
        );
      }
      const offset = query.offset ?? 0;
      rows = rows.slice(offset, offset + query.limit);
      return readRows(rows);
    },

    async countByStatus() {
      const rows = await db.words.toArray();
      const counts: Record<WordStatus, number> = { new: 0, learning: 0, known: 0 };
      for (const row of rows) {
        if (row.deletedAt) continue;
        counts[row.status] += 1;
      }
      return counts;
    },

    add: addWord,
    addFromInsight,

    async addMany(inputs: NewWordInput[]) {
      const results: Word[] = [];
      // Sequential on purpose: each add() must observe the unique-index effect of
      // the previous one, so "leverage" pasted twice in one batch creates one word,
      // not two (audit #12 — addMultipleWords used to compare against the
      // pre-batch list and let duplicates through).
      for (const input of inputs) {
        results.push(await addWord(input));
      }
      return results;
    },

    async patch(id, patch) {
      const now = Date.now();
      return db.transaction('rw', db.words, async () => {
        const row = await db.words.get(id);
        if (!row) throw new Error(`word_not_found:${id}`);
        const current = fromRow(row);
        const updated: Word = { ...current, ...patch, id: current.id, updatedAt: now };
        await db.words.put(toRow(updated, now));
        return updated;
      });
    },

    async remove(id) {
      const now = Date.now();
      await db.words.update(id, { deletedAt: now, updatedAt: now });
    },

    async dueBefore(now, limit) {
      const rows = await db.words.where('dueAt').belowOrEqual(now).limit(limit * 2).toArray();
      const words = await readRows(rows.filter((r) => !r.deletedAt));
      return words.sort((a, b) => a.dueAt - b.dueAt).slice(0, limit);
    },

    async newNeverReviewed(limit, excludeIds) {
      const exclude = new Set(excludeIds);
      const rows = await db.words
        .where('[status+createdAt]')
        .between(['new', Dexie.minKey], ['new', Dexie.maxKey])
        .toArray();
      const filtered = rows.filter((r) => !r.deletedAt && !exclude.has(r.id)).slice(0, limit);
      return readRows(filtered);
    },

    async leeches(limit) {
      const rows = await db.words
        .where('[isLeech+dueAt]')
        .between([1, Dexie.minKey], [1, Dexie.maxKey])
        .toArray();
      const words = await readRows(rows.filter((r) => !r.deletedAt));
      return words.sort((a, b) => a.dueAt - b.dueAt).slice(0, limit);
    },
  };
}
