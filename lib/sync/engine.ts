import 'client-only';
import type { Table } from 'dexie';
import type { z } from 'zod';
import { getDb, USER_ID, type LexioDb, type UserRow } from '@/lib/db/dexie';
import type { WordRow } from '@/lib/db/rows';
import { quarantineRow, safeParseRow } from '@/lib/db/read';
import { getRepos } from '@/lib/repositories';
import { DEFAULT_SETTINGS, DEFAULT_STATS } from '@/lib/repositories/dexie/user-repository';
import { getFirebaseAuth, getFirebaseFirestore } from '@/lib/firebase/client';
import { pullSince, pullUser, pushBatch, pushUser } from './firestore';
import { mergeById, mergeSkipped, mergeUserRow, mergeWords, recomputeStatsFromReviews } from './merge';
import { GrammarAttemptRowSchema, ImportRowSchema, ReviewRowSchema, SkippedRowSchema, WordRowSchema } from './validate';
import type { SyncCounts, SyncCursor, SyncResult, SyncedCollection, UserSyncDoc } from './types';

/**
 * Orchestrates one full two-way sync round for a signed-in uid. Talks to
 * Dexie via `getDb()` directly rather than through getRepos() for the bulk
 * delta-scan/upsert operations — the same exception lib/db/claim-legacy.ts
 * already takes (see its header comment) for the same reason: this is
 * persistence-infrastructure code, not app/UI logic, and the operations it
 * needs ("every row changed since X", "write this exact merged row") don't
 * fit the domain-shaped repository interfaces the UI actually calls. It
 * still goes through getRepos().meta for cursor bookkeeping — meta is
 * already the generic KV seam other infrastructure (the topup throttle)
 * uses for exactly this kind of thing.
 */

function cursorKey(name: SyncedCollection): string {
  return `sync:cursor:${name}`;
}

async function getCursor(meta: ReturnType<typeof getRepos>['meta'], name: SyncedCollection): Promise<SyncCursor> {
  return (await meta.get<SyncCursor>(cursorKey(name))) ?? { pulledAt: 0, pushedAt: 0 };
}

async function setCursor(meta: ReturnType<typeof getRepos>['meta'], name: SyncedCollection, cursor: SyncCursor): Promise<void> {
  await meta.put(cursorKey(name), cursor);
}

interface SimpleSyncArgs<T extends { updatedAt: number }> {
  db: LexioDb;
  table: Table<T, string>;
  name: SyncedCollection;
  uid: string;
  cursor: SyncCursor;
  now: number;
  schema: z.ZodType<T>;
  mergeFn: (local: T[], remote: T[]) => T[];
  keyOf: (row: T) => string;
  /** imports only — strips `rawText` before pushing (docs/data-model.md: the
   * largest field, only needed locally to retry a failed analysis). */
  transformForPush?: (row: T) => Record<string, unknown>;
}

/**
 * Shared sync step for every collection EXCEPT `words` — reviews, imports,
 * skipped, grammarAttempts. Each is either append-only (reviews,
 * grammarAttempts) or keyed by a field that's already the local primary key
 * (skipped's wordLower, imports' random id never collides across devices),
 * so a plain id/key-based LWW (mergeById/mergeSkipped, see merge.ts) is
 * always correct — none of them have words' "two devices independently
 * created the same logical row under two different ids" problem.
 */
async function syncSimpleCollection<T extends { updatedAt: number }>(
  args: SimpleSyncArgs<T>,
): Promise<{ pushed: number; pulled: number; cursor: SyncCursor }> {
  const { db, table, name, uid, cursor, now, schema, mergeFn, keyOf, transformForPush } = args;
  const firestoreDb = getFirebaseFirestore();

  const page = await pullSince(firestoreDb, uid, name, cursor.pulledAt);
  const remoteRows: T[] = [];
  for (const raw of page.rows) {
    const parsed = safeParseRow(schema, raw);
    if (parsed.ok) {
      remoteRows.push(parsed.value);
    } else {
      const rawObj = raw as Record<string, unknown>;
      const id = typeof rawObj.id === 'string' ? rawObj.id : typeof rawObj.wordLower === 'string' ? rawObj.wordLower : 'unknown';
      await quarantineRow(db, `remote:${name}`, id, raw, parsed.issues);
    }
  }

  const localChanged = await table.where('updatedAt').above(cursor.pushedAt).toArray();
  const merged = mergeFn(localChanged, remoteRows);
  if (merged.length) await table.bulkPut(merged);

  // Push only rows where LOCAL's value is what actually won the merge — a
  // row present in localChanged whose remote counterpart was newer already
  // has the right data in Firestore; re-pushing it would just be a wasted
  // write (harmless, since docId=primary key makes it idempotent, but
  // pointless).
  const localByKey = new Map(localChanged.map((r) => [keyOf(r), r]));
  const toPush = merged.filter((r) => {
    const localRow = localByKey.get(keyOf(r));
    return !!localRow && localRow.updatedAt === r.updatedAt;
  });
  if (toPush.length) {
    const wireRows = (transformForPush ? toPush.map(transformForPush) : toPush) as Record<string, unknown>[];
    await pushBatch(firestoreDb, uid, name, wireRows);
  }

  return {
    pushed: toPush.length,
    pulled: remoteRows.length,
    // Advancing pushedAt to `now` is safe even though only a subset of
    // localChanged got pushed: every id in localChanged was just resolved
    // one way or another above (pushed as the winner, or correctly
    // superseded by a newer remote row already sitting in Firestore) — none
    // of it is left "still needing a push" after this round.
    cursor: { pulledAt: page.maxUpdatedAt ?? cursor.pulledAt, pushedAt: now },
  };
}

/**
 * `words` gets its own step instead of syncSimpleCollection because of the
 * one real hazard in this whole feature (docs/data-model.md): a word added
 * independently on two devices before they ever synced produces two rows
 * with the same `wordLower` but different `id`s. mergeWords() (merge.ts)
 * needs the FULL local table to detect that — not just rows changed since
 * the last push — so this reads `db.words.toArray()` instead of a delta
 * scan.
 */
async function syncWords(args: {
  db: LexioDb;
  uid: string;
  cursor: SyncCursor;
  now: number;
}): Promise<{ pushed: number; pulled: number; cursor: SyncCursor }> {
  const { db, uid, cursor, now } = args;
  const firestoreDb = getFirebaseFirestore();

  const page = await pullSince(firestoreDb, uid, 'words', cursor.pulledAt);
  const remoteRows: WordRow[] = [];
  for (const raw of page.rows) {
    const parsed = safeParseRow(WordRowSchema, raw);
    if (parsed.ok) {
      remoteRows.push(parsed.value as WordRow);
    } else {
      const rawObj = raw as Record<string, unknown>;
      const id = typeof rawObj.id === 'string' ? rawObj.id : 'unknown';
      await quarantineRow(db, 'remote:words', id, raw, parsed.issues);
    }
  }

  const localAll = await db.words.toArray();
  const { toPersist, toPush: dedupePush } = mergeWords(localAll, remoteRows, now);
  if (toPersist.length) await db.words.bulkPut(toPersist);

  const dedupeIds = new Set(dedupePush.map((r) => r.id));
  const persistedById = new Map(toPersist.map((r) => [r.id, r]));
  const normalPush = localAll.filter((r) => {
    if (r.updatedAt <= cursor.pushedAt) return false; // not touched since last push
    if (dedupeIds.has(r.id)) return false; // already covered by the dedupe push below
    const winner = persistedById.get(r.id);
    return !winner || winner.updatedAt === r.updatedAt; // wasn't beaten by a same-id remote LWW
  });

  const toPushAll = [...dedupePush, ...normalPush];
  if (toPushAll.length) {
    await pushBatch(firestoreDb, uid, 'words', toPushAll as unknown as Record<string, unknown>[]);
  }

  return {
    pushed: toPushAll.length,
    pulled: remoteRows.length,
    cursor: { pulledAt: page.maxUpdatedAt ?? cursor.pulledAt, pushedAt: now },
  };
}

/** Settings+stats — one Firestore doc (`users/{uid}`) mirroring the local
 * `user` table's singleton row. Runs LAST in syncOnce() because it recomputes
 * `stats` from the reviews table, which must already reflect this round's
 * merge (see merge.ts's recomputeStatsFromReviews doc comment for why stats
 * are recomputed rather than merged as data). */
async function syncUser(args: { db: LexioDb; uid: string; now: number }): Promise<{ pushed: number; pulled: number }> {
  const { db, uid, now } = args;
  const firestoreDb = getFirebaseFirestore();

  const localRow: UserRow = (await db.user.get(USER_ID)) ?? {
    id: USER_ID,
    settings: DEFAULT_SETTINGS,
    stats: DEFAULT_STATS,
    updatedAt: 0,
  };
  const remoteDoc = await pullUser(firestoreDb, uid);

  const allReviews = await db.reviews.toArray();
  const recomputedStats = recomputeStatsFromReviews(allReviews);

  const mergedRow = remoteDoc
    ? mergeUserRow(localRow, { id: USER_ID, settings: remoteDoc.settings, stats: remoteDoc.stats, updatedAt: remoteDoc.updatedAt }, recomputedStats, now)
    : { ...localRow, stats: recomputedStats, updatedAt: now };

  await db.user.put(mergedRow);

  const authUser = getFirebaseAuth().currentUser;
  const doc: UserSyncDoc = {
    email: authUser?.email ?? '',
    displayName: authUser?.displayName ?? undefined,
    settings: mergedRow.settings,
    stats: mergedRow.stats,
    updatedAt: mergedRow.updatedAt,
  };
  await pushUser(firestoreDb, uid, doc);

  return { pushed: 1, pulled: remoteDoc ? 1 : 0 };
}

async function syncOnceInner({ uid, now }: { uid: string; now: number }): Promise<SyncResult> {
  const db = getDb();
  const repos = getRepos();

  const pushed: Partial<SyncCounts> = {};
  const pulled: Partial<SyncCounts> = {};

  try {
    const wordsCursor = await getCursor(repos.meta, 'words');
    const wordsResult = await syncWords({ db, uid, cursor: wordsCursor, now });
    await setCursor(repos.meta, 'words', wordsResult.cursor);
    pushed.words = wordsResult.pushed;
    pulled.words = wordsResult.pulled;

    const reviewsCursor = await getCursor(repos.meta, 'reviews');
    const reviewsResult = await syncSimpleCollection({
      db,
      table: db.reviews,
      name: 'reviews',
      uid,
      cursor: reviewsCursor,
      now,
      schema: ReviewRowSchema,
      mergeFn: mergeById,
      keyOf: (r) => r.id,
    });
    await setCursor(repos.meta, 'reviews', reviewsResult.cursor);
    pushed.reviews = reviewsResult.pushed;
    pulled.reviews = reviewsResult.pulled;

    const importsCursor = await getCursor(repos.meta, 'imports');
    const importsResult = await syncSimpleCollection({
      db,
      table: db.imports,
      name: 'imports',
      uid,
      cursor: importsCursor,
      now,
      schema: ImportRowSchema,
      mergeFn: mergeById,
      keyOf: (r) => r.id,
      transformForPush: (row) => {
        const wire: Record<string, unknown> = { ...row };
        delete wire.rawText;
        return wire;
      },
    });
    await setCursor(repos.meta, 'imports', importsResult.cursor);
    pushed.imports = importsResult.pushed;
    pulled.imports = importsResult.pulled;

    const skippedCursor = await getCursor(repos.meta, 'skipped');
    const skippedResult = await syncSimpleCollection({
      db,
      table: db.skipped,
      name: 'skipped',
      uid,
      cursor: skippedCursor,
      now,
      schema: SkippedRowSchema,
      mergeFn: mergeSkipped,
      keyOf: (r) => r.wordLower,
    });
    await setCursor(repos.meta, 'skipped', skippedResult.cursor);
    pushed.skipped = skippedResult.pushed;
    pulled.skipped = skippedResult.pulled;

    const grammarCursor = await getCursor(repos.meta, 'grammarAttempts');
    const grammarResult = await syncSimpleCollection({
      db,
      table: db.grammarAttempts,
      name: 'grammarAttempts',
      uid,
      cursor: grammarCursor,
      now,
      schema: GrammarAttemptRowSchema,
      mergeFn: mergeById,
      keyOf: (r) => r.id,
    });
    await setCursor(repos.meta, 'grammarAttempts', grammarResult.cursor);
    pushed.grammarAttempts = grammarResult.pushed;
    pulled.grammarAttempts = grammarResult.pulled;

    await syncUser({ db, uid, now });

    return { ok: true, syncedAt: now, pushed, pulled };
  } catch (err) {
    return {
      ok: false,
      syncedAt: now,
      pushed,
      pulled,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// De-dupes overlapping calls (stores/sync-store.ts fires syncOnce from
// several independent triggers — login, tab focus, post-session, a write
// debounce — that can easily land within milliseconds of each other) into
// one in-flight run, same `inFlight` promise-guard shape stores/topup-store.ts
// already uses for its own throttle.
let inFlight: Promise<SyncResult> | null = null;

export function syncOnce(args: { uid: string; now: number }): Promise<SyncResult> {
  if (inFlight) return inFlight;
  const run = syncOnceInner(args).finally(() => {
    inFlight = null;
  });
  inFlight = run;
  return run;
}
