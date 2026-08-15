import { getDb } from '@/lib/db/dexie';
import type { Cefr } from '@/lib/domain';
import { CorpusBandFileSchema, type CorpusEntry } from './types';

// docs/decision.md ADR-015 — the corpus is fetched from public/, never imported: a
// static `import`/`await import()` of a JSON band file goes into the JS bundle (or a
// build-hashed chunk that can't be HTTP-cached across deploys) and gets parsed at
// hydration for every user on every load, whether or not they ever need that band.
// A plain `fetch` costs 0 bundle bytes, is browser-cacheable (see next.config.ts's
// immutable Cache-Control on /corpus/:path*), and needs no bundler involvement.
const CORPUS_VERSION = 'v1';

const memo = new Map<Cefr, CorpusEntry[]>();

function metaKey(band: Cefr): string {
  return `corpus:${CORPUS_VERSION}:${band}`;
}

async function fetchBand(band: Cefr): Promise<CorpusEntry[]> {
  let res: Response;
  try {
    res = await fetch(`/corpus/${CORPUS_VERSION}/${band}.json`);
  } catch {
    return []; // offline — caller (lib/corpus/pick.ts callers) degrades gracefully
  }
  // A1 (and any future band with no shipped file) resolves to a clean empty list
  // rather than a thrown error — the placement floor is A2, so A1 is never actually
  // requested by the app, but nothing here should assume that.
  if (!res.ok) return [];

  const json: unknown = await res.json().catch(() => null);
  const parsed = CorpusBandFileSchema.safeParse(json);
  if (!parsed.success) {
    console.warn(`[lexio/corpus] ${band}.json failed validation, treating as empty`, parsed.error.issues);
    return [];
  }
  return parsed.data.rows.map(([word, pos, rank, vi]) => ({ word, pos, rank, vi, band: parsed.data.band }));
}

/**
 * Loads one CEFR band, trying (in order): the in-memory module cache, the IndexedDB
 * `meta` cache (works offline, survives reloads — no new Dexie table needed, `meta`
 * is already a generic KV store), then a network fetch. A successful network fetch
 * is written back to `meta` so the next load — including fully offline — is instant.
 */
export async function loadBand(band: Cefr): Promise<CorpusEntry[]> {
  const cached = memo.get(band);
  if (cached) return cached;

  if (typeof indexedDB !== 'undefined') {
    try {
      const row = await getDb().meta.get(metaKey(band));
      if (row && Array.isArray(row.value)) {
        const entries = row.value as CorpusEntry[];
        memo.set(band, entries);
        return entries;
      }
    } catch {
      // fall through to network — a corrupt/missing meta row is not fatal
    }
  }

  const entries = await fetchBand(band);
  memo.set(band, entries);
  if (entries.length > 0 && typeof indexedDB !== 'undefined') {
    void getDb()
      .meta.put({ key: metaKey(band), value: entries })
      .catch(() => {
        // best-effort cache write — a failed put just means the next load re-fetches
      });
  }
  return entries;
}

/** Test-only: the module-level memo would otherwise leak state across tests. */
export function clearCorpusMemoForTests(): void {
  memo.clear();
}
