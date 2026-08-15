import { getDb } from '@/lib/db/dexie';
import type { MetaRepository } from '../types';

export function createDexieMetaRepository(): MetaRepository {
  const db = getDb();

  return {
    async get<T>(key: string) {
      const row = await db.meta.get(key);
      return row?.value as T | undefined;
    },
    async put(key, value) {
      await db.meta.put({ key, value });
    },
  };
}
