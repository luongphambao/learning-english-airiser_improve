import Dexie from 'dexie';
import { LexioDb, LOCAL_DB_NAME, USER_ID, getDb } from './dexie';

/**
 * One-time offer, on first sign-in, to copy the pre-account local notebook
 * (`lexio`, written before this device had ever seen a login screen) into the
 * newly-active per-account database (`lexio:<uid>`, see setActiveUser() in
 * ./dexie.ts). Mirrors migrateFromLocalStorage()'s shape (meta-flag guard,
 * copy-never-delete-the-source) but between two Dexie databases instead of
 * localStorage -> Dexie.
 *
 * Deliberately asks before copying (components/layout/legacy-claim-banner.tsx)
 * rather than claiming automatically: on a shared/public computer, silently
 * attaching whatever was typed into this browser before to a freshly-created
 * account would leak data across people, not just across devices for the same
 * person.
 */
const CLAIM_FLAG = 'claimed:legacy';

type ClaimDecision = { decision: 'claimed'; at: number; wordCount: number } | { decision: 'declined'; at: number } | { decision: 'skipped'; reason: string; at: number };

/** True when there's something worth asking about: a non-empty legacy `lexio`
 * database exists, the current (per-account) notebook is still empty, and
 * this account hasn't already answered the prompt. Safe to call repeatedly —
 * it only reads, never writes. */
export async function hasPendingLegacyClaim(): Promise<boolean> {
  const db = getDb();
  if (db.name === LOCAL_DB_NAME) return false; // signed out — nothing to "claim into"

  const already = await db.meta.get(CLAIM_FLAG);
  if (already) return false;

  const targetCount = await db.words.count();
  if (targetCount > 0) return false;

  const legacyExists = await Dexie.exists(LOCAL_DB_NAME);
  if (!legacyExists) return false;

  const legacy = new LexioDb(LOCAL_DB_NAME);
  try {
    const legacyCount = await legacy.words.count();
    return legacyCount > 0;
  } finally {
    legacy.close();
  }
}

/** Copies every table from the legacy local database into the current
 * per-account database. Never deletes or mutates the legacy database — same
 * "recoverable if something goes wrong" rule as migrateFromLocalStorage(). */
export async function claimLegacyNotebook(now: number = Date.now()): Promise<{ claimed: boolean; wordCount: number }> {
  const db = getDb();
  const legacy = new LexioDb(LOCAL_DB_NAME);
  try {
    const [words, reviews, user, studySessions, imports, skipped, grammarAttempts] = await Promise.all([
      legacy.words.toArray(),
      legacy.reviews.toArray(),
      legacy.user.toArray(),
      legacy.studySessions.toArray(),
      legacy.imports.toArray(),
      legacy.skipped.toArray(),
      legacy.grammarAttempts.toArray(),
    ]);

    await db.transaction(
      'rw',
      [db.words, db.reviews, db.user, db.studySessions, db.imports, db.skipped, db.grammarAttempts, db.meta],
      async () => {
        if (words.length) await db.words.bulkPut(words);
        if (reviews.length) await db.reviews.bulkPut(reviews);
        // `user` is a singleton row keyed by the constant USER_ID in both
        // databases — bulkPut naturally overwrites the fresh account's
        // just-created default row with the legacy one, id unchanged.
        if (user.length) await db.user.bulkPut(user.map((u) => ({ ...u, id: USER_ID })));
        if (studySessions.length) await db.studySessions.bulkPut(studySessions);
        if (imports.length) await db.imports.bulkPut(imports);
        if (skipped.length) await db.skipped.bulkPut(skipped);
        if (grammarAttempts.length) await db.grammarAttempts.bulkPut(grammarAttempts);

        const flag: ClaimDecision = { decision: 'claimed', at: now, wordCount: words.length };
        await db.meta.put({ key: CLAIM_FLAG, value: flag });
      },
    );

    return { claimed: true, wordCount: words.length };
  } finally {
    legacy.close();
  }
}

/** Records "no" so the banner never asks this account again — it does not
 * touch either database's rows. */
export async function declineLegacyClaim(now: number = Date.now()): Promise<void> {
  const db = getDb();
  const flag: ClaimDecision = { decision: 'declined', at: now };
  await db.meta.put({ key: CLAIM_FLAG, value: flag });
}
