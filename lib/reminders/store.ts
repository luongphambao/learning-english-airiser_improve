import 'server-only';
import { getAdminFirestore } from '@/lib/firebase/admin';
import type { StoredTokens } from '@/lib/auth/google';
import type { ReminderWord } from '@/lib/gmail/render';

/**
 * Server-side counterpart to lib/auth/google.ts's cookie-based token store.
 *
 * The interactive "send test email" flow (Settings) keeps its tokens in an
 * httpOnly browser cookie — deliberately NOT tied to the Firebase uid (see
 * the comment in app/api/auth/google/callback/route.ts explaining why
 * connecting Gmail must not double as signing in). A cron job has no cookie
 * jar to read, so the automated path needs its own durable, per-uid store —
 * this collection. It is written in two places only: the OAuth callback
 * (when a Firebase session already exists at connect time) and the cron
 * route's own token-refresh callback; it is never exposed through a
 * client-reachable API and carries no Firestore security rule of its own
 * (firestore.rules' unnamed final comment covers this: default-deny), so
 * only the Admin SDK — server code with its own trusted credentials — can
 * ever touch it. See docs/decision.md ADR-027.
 */
const COLLECTION = 'gmailTokens';

export interface GmailTokenDoc extends StoredTokens {
  /** Asia/Ho_Chi_Minh day-key (lib/srs/date.ts `dayKey`) the last automated
   * reminder was actually sent on — the cron route's dedup guard against a
   * retried/overlapping run re-sending the same day's digest. */
  lastReminderDayKey?: string | null;
}

export async function getGmailTokensForUser(uid: string): Promise<GmailTokenDoc | null> {
  const snap = await getAdminFirestore().collection(COLLECTION).doc(uid).get();
  return snap.exists ? (snap.data() as GmailTokenDoc) : null;
}

/** Merge-write — callers pass only the fields they own (token refresh writes
 * token fields, the cron route's post-send write touches only
 * `lastReminderDayKey`), so a merge keeps them from clobbering each other. */
export async function setGmailTokensForUser(uid: string, patch: Partial<GmailTokenDoc>): Promise<void> {
  await getAdminFirestore().collection(COLLECTION).doc(uid).set(patch, { merge: true });
}

export async function clearGmailTokensForUser(uid: string): Promise<void> {
  await getAdminFirestore().collection(COLLECTION).doc(uid).delete();
}

/** Every uid whose synced `users/{uid}.settings.reminderHour` equals the
 * given Asia/Ho_Chi_Minh hour (0..23) — the cron route calls this once per
 * hourly tick to find who's due right now. Capped at `limit`, same
 * "personal-app scale, not a multi-tenant firehose" reasoning
 * lib/leaderboard already applies to its 200-row board cap. */
export async function findUidsWithReminderHour(hourVN: number, limit = 200): Promise<string[]> {
  const snap = await getAdminFirestore()
    .collection('users')
    .where('settings.reminderHour', '==', hourVN)
    .limit(limit)
    .get();
  return snap.docs.map((d) => d.id);
}

/** Mirrors the client's `dueBefore()` (lib/repositories/dexie/word-repository.ts):
 * over-fetch by 2x, drop tombstoned rows, sort, then cap — because a
 * `deletedAt == null` equality filter combined with the `dueAt` range filter
 * would need a composite index this project doesn't otherwise need. Firestore
 * documents under `users/{uid}/words` are the exact wire format of the local
 * `WordRow` (lib/sync/types.ts header comment), so the raw doc data already
 * has `word`/`meaningVi`/`exampleSentence`/`ipa`. */
export async function getDueWordsForUser(uid: string, now: number, limit: number): Promise<ReminderWord[]> {
  const snap = await getAdminFirestore()
    .collection('users')
    .doc(uid)
    .collection('words')
    .where('dueAt', '<=', now)
    .orderBy('dueAt', 'asc')
    .limit(limit * 2)
    .get();

  return snap.docs
    .map((d) => d.data() as Record<string, unknown>)
    .filter((row) => !row.deletedAt)
    .slice(0, limit)
    .map((row) => ({
      word: String(row.word ?? ''),
      meaningVi: String(row.meaningVi ?? ''),
      exampleSentence: typeof row.exampleSentence === 'string' ? row.exampleSentence : undefined,
      ipa: typeof row.ipa === 'string' ? row.ipa : undefined,
    }))
    .filter((w) => w.word && w.meaningVi);
}
