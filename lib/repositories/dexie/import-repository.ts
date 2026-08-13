import { getDb } from '@/lib/db/dexie';
import { newId } from '@/lib/db/ids';
import type { Import } from '@/lib/domain';
import type { ImportRepository, NewImportInput } from '../types';

export function createDexieImportRepository(): ImportRepository {
  const db = getDb();

  async function getOrThrow(id: string): Promise<Import> {
    const row = await db.imports.get(id);
    if (!row) throw new Error(`import_not_found:${id}`);
    return row;
  }

  return {
    async create(input: NewImportInput) {
      const row: Import = {
        id: newId('imp_'),
        fileName: input.fileName,
        kind: input.kind,
        createdAt: Date.now(),
        status: 'analyzing',
        candidates: [],
        addedCount: 0,
        error: null,
        rawText: input.rawText,
        analysis: null,
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
        const updated: Import = { ...row, status: 'ready', candidates, error: null };
        await db.imports.put(updated);
        return updated;
      });
    },

    async setAnalysis(id, analysis) {
      return db.transaction('rw', db.imports, async () => {
        const row = await getOrThrow(id);
        const updated: Import = { ...row, status: 'ready', analysis, error: null };
        await db.imports.put(updated);
        return updated;
      });
    },

    async setTriage(id, word, triage) {
      return db.transaction('rw', db.imports, async () => {
        const row = await getOrThrow(id);
        const candidates = row.candidates.map((c) => (c.word === word ? { ...c, triage } : c));
        const updated: Import = { ...row, candidates };
        await db.imports.put(updated);
        return updated;
      });
    },

    async fail(id, error) {
      return db.transaction('rw', db.imports, async () => {
        const row = await getOrThrow(id);
        const updated: Import = { ...row, status: 'failed', error };
        await db.imports.put(updated);
        return updated;
      });
    },

    async complete(id, addedCount) {
      return db.transaction('rw', db.imports, async () => {
        const row = await getOrThrow(id);
        const updated: Import = { ...row, status: 'done', addedCount };
        await db.imports.put(updated);
        return updated;
      });
    },
  };
}
