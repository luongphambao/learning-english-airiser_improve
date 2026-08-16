import { getDb, type ImportRow } from '@/lib/db/dexie';
import { newId } from '@/lib/db/ids';
import type { ImportRepository, NewImportInput } from '../types';

export function createDexieImportRepository(): ImportRepository {
  const db = getDb();

  async function getOrThrow(id: string): Promise<ImportRow> {
    const row = await db.imports.get(id);
    if (!row) throw new Error(`import_not_found:${id}`);
    return row;
  }

  return {
    async create(input: NewImportInput) {
      const now = Date.now();
      const row: ImportRow = {
        id: newId('imp_'),
        fileName: input.fileName,
        kind: input.kind,
        createdAt: now,
        status: 'analyzing',
        candidates: [],
        addedCount: 0,
        error: null,
        rawText: input.rawText,
        analysis: null,
        updatedAt: now,
      };
      await db.imports.put(row);
      return row;
    },

    async get(id) {
      return (await db.imports.get(id)) ?? null;
    },

    async list(limit = 20) {
      const rows = await db.imports.orderBy('createdAt').reverse().limit(limit).toArray();
      return rows;
    },

    async setCandidates(id, candidates) {
      return db.transaction('rw', db.imports, async () => {
        const row = await getOrThrow(id);
        const updated: ImportRow = { ...row, status: 'ready', candidates, error: null, updatedAt: Date.now() };
        await db.imports.put(updated);
        return updated;
      });
    },

    async setAnalysis(id, analysis) {
      return db.transaction('rw', db.imports, async () => {
        const row = await getOrThrow(id);
        const updated: ImportRow = { ...row, status: 'ready', analysis, error: null, updatedAt: Date.now() };
        await db.imports.put(updated);
        return updated;
      });
    },

    async setTriage(id, word, triage) {
      return db.transaction('rw', db.imports, async () => {
        const row = await getOrThrow(id);
        const candidates = row.candidates.map((c) => (c.word === word ? { ...c, triage } : c));
        const updated: ImportRow = { ...row, candidates, updatedAt: Date.now() };
        await db.imports.put(updated);
        return updated;
      });
    },

    async fail(id, error) {
      return db.transaction('rw', db.imports, async () => {
        const row = await getOrThrow(id);
        const updated: ImportRow = { ...row, status: 'failed', error, updatedAt: Date.now() };
        await db.imports.put(updated);
        return updated;
      });
    },

    async complete(id, addedCount) {
      return db.transaction('rw', db.imports, async () => {
        const row = await getOrThrow(id);
        const updated: ImportRow = { ...row, status: 'done', addedCount, updatedAt: Date.now() };
        await db.imports.put(updated);
        return updated;
      });
    },
  };
}
