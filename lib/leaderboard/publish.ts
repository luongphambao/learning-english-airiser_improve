import 'client-only';
import { getRepos } from '@/lib/repositories';
import { getFirebaseAuth, getFirebaseFirestore } from '@/lib/firebase/client';
import { buildMyEntry } from './metrics';
import { toLeaderboardDoc } from './map';
import { resolveDisplayName } from './name';
import { publishEntry } from './remote';

const PUBLISHED_DIGEST_KEY = 'leaderboard:publishedDigest';

// Not translated: this is the value actually written to a public Firestore doc's
// `name` field (read by every viewer regardless of their own locale setting), not
// UI copy rendered through t() — same reasoning as the hardcoded Vietnamese
// strings in lib/auth/firebase-auth.ts's describeAuthError.
const ANONYMOUS_NAME_FALLBACK = 'Người học';

/** Stable digest of everything in a LeaderboardDoc EXCEPT `updatedAt` — used to
 * skip a write when nothing actually changed. `updatedAt` is excluded on purpose:
 * it changes every call by definition, so including it would make the digest
 * never match and defeat the whole point. */
function digestOf(doc: ReturnType<typeof toLeaderboardDoc>): string {
  const { uid, name, level, words, longestStreak, totalReviews, totalCorrect, newLast7, leechesConquered } = doc;
  return JSON.stringify({ uid, name, level, words, longestStreak, totalReviews, totalCorrect, newLast7, leechesConquered });
}

/**
 * Publishes the signed-in user's aggregate stats to `leaderboard/{uid}` — called
 * from stores/sync-store.ts right after a successful syncOnce() (docs/decision.md
 * ADR-025). No-ops silently when signed out; the caller (sync-store) already only
 * runs sync for a signed-in uid, but this stays safe to call on its own too.
 *
 * Throttled by content, not by time: stores/sync-store.ts's sync() is triggered
 * from several places (page load, tab focus, a background interval, the manual
 * "Đồng bộ ngay" button) that can fire in quick succession with nothing to report
 * — publishing on every single one would be a lot of pointless writes. The `meta`
 * KV table (same mechanism as sync's own per-collection cursors and the corpus
 * top-up throttle) remembers a digest of the last-published payload; an unchanged
 * digest skips the Firestore write entirely.
 */
export async function publishLeaderboard(now: number): Promise<void> {
  const authUser = getFirebaseAuth().currentUser;
  if (!authUser) return;

  const repos = getRepos();
  const [{ settings, stats }, words] = await Promise.all([
    repos.user.getProfile(),
    repos.words.list({ limit: 5000 }),
  ]);

  const name = resolveDisplayName(
    { nickname: settings.leaderboardName, displayName: authUser.displayName },
    ANONYMOUS_NAME_FALLBACK,
  );
  const me = buildMyEntry(stats, settings, words, now, { uid: authUser.uid, name });
  const doc = toLeaderboardDoc(me, authUser.uid, now);
  const digest = digestOf(doc);

  const lastDigest = await repos.meta.get<string>(PUBLISHED_DIGEST_KEY);
  if (lastDigest === digest) return;

  await publishEntry(getFirebaseFirestore(), doc);
  await repos.meta.put(PUBLISHED_DIGEST_KEY, digest);
}
