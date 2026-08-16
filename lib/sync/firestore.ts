import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  setDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import type { SyncedCollection, UserSyncDoc } from './types';

/**
 * I/O boundary for lib/sync/** — talks to Firestore, nothing else. Domain
 * validation (safeParseRow) and merge decisions live in engine.ts; this file
 * only knows how to read/write plain objects at collection paths. Every doc
 * is stored and returned as-is — the local Row shapes (WordRow, ReviewRow,
 * ...) already are the wire format, see types.ts's header comment.
 */

const PAGE_SIZE = 500;
// Firestore's writeBatch() hard cap — chunk any push larger than this.
const BATCH_SIZE = 500;

function collectionPath(uid: string, name: SyncedCollection): string {
  return `users/${uid}/${name}`;
}

/** Doc id per collection: `skipped` uses its own local primary key
 * (`wordLower`, already globally unique per user); everything else uses
 * `id`. Keeping the doc id equal to the local primary key is what makes a
 * push idempotent — re-pushing the same row after a retry overwrites the
 * same doc instead of creating a duplicate. */
function docIdOf(name: SyncedCollection, row: Record<string, unknown>): string {
  return name === 'skipped' ? (row.wordLower as string) : (row.id as string);
}

export interface PullPage {
  rows: Record<string, unknown>[];
  /** Highest `updatedAt` seen across every row returned — `null` if nothing
   * changed since `cursor` (caller should NOT advance its cursor in that
   * case, since `null` means "no new information", not "everything is at
   * the old cursor"). */
  maxUpdatedAt: number | null;
}

/**
 * Every doc in `name` with `updatedAt > cursor`, oldest first, paginated
 * until exhausted. Simplification worth naming: pagination re-queries with
 * `updatedAt > <last row's updatedAt>` rather than a full `(updatedAt,
 * __name__)` compound cursor, so it could in principle skip a sibling doc
 * that shares the exact same millisecond timestamp as the page boundary —
 * acceptable here (personal, single-user data at a scale where doc counts
 * are in the hundreds/low-thousands, not a multi-tenant firehose).
 */
export async function pullSince(
  db: Firestore,
  uid: string,
  name: SyncedCollection,
  cursor: number,
): Promise<PullPage> {
  const rows: Record<string, unknown>[] = [];
  let maxUpdatedAt: number | null = null;
  let after = cursor;

  for (;;) {
    const q = query(
      collection(db, collectionPath(uid, name)),
      where('updatedAt', '>', after),
      orderBy('updatedAt', 'asc'),
      fsLimit(PAGE_SIZE),
    );
    const snap = await getDocs(q);
    if (snap.empty) break;

    for (const d of snap.docs) {
      const data = d.data();
      rows.push(data);
      const updatedAt = data.updatedAt as number;
      if (maxUpdatedAt === null || updatedAt > maxUpdatedAt) maxUpdatedAt = updatedAt;
      after = updatedAt;
    }
    if (snap.size < PAGE_SIZE) break;
  }

  return { rows, maxUpdatedAt };
}

/** Writes every row to its doc (id per docIdOf above), chunked under
 * Firestore's per-batch write cap. A `set()`, not `update()` — rows are
 * always the full row, so this is safe to retry after a partial failure
 * (each chunk commits atomically; a failed chunk can just be re-pushed). */
export async function pushBatch(
  db: Firestore,
  uid: string,
  name: SyncedCollection,
  rows: Record<string, unknown>[],
): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    for (const row of chunk) {
      batch.set(doc(db, collectionPath(uid, name), docIdOf(name, row)), row);
    }
    await batch.commit();
  }
}

export async function pullUser(db: Firestore, uid: string): Promise<UserSyncDoc | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as UserSyncDoc) : null;
}

export async function pushUser(db: Firestore, uid: string, data: UserSyncDoc): Promise<void> {
  await setDoc(doc(db, 'users', uid), data);
}
