const GUEST_FLAG_KEY = 'lexio:guest';

/**
 * "Try it without an account" mode. Deliberately a client-only flag rather than a
 * Firebase anonymous account: with no Firebase user there is no uid, and the two
 * things a guest must not do fall out for free — `publishLeaderboard()` and
 * `useSyncStore.sync()` both return early without one, and `SyncScheduler` is
 * never mounted (app/providers.tsx). An anonymous account would hand out a real
 * uid and both of those would start running, needing extra guards plus a
 * firestore.rules change.
 *
 * The server needs no matching concept: a guest has no `lexio_user_session`
 * cookie, so every `requireSession` guard already refuses them.
 *
 * Guest work lands in the shared local `lexio` Dexie database (setActiveUser(null)),
 * exactly where a signed-out user's work goes today — so registering later
 * surfaces the existing LegacyClaimBanner offering to carry the progress over.
 */
export function isGuestMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(GUEST_FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

export function enterGuestMode(): void {
  try {
    window.localStorage.setItem(GUEST_FLAG_KEY, '1');
  } catch {
    // Private-mode storage refusal — the gate falls back to asking for a login.
  }
}

export function exitGuestMode(): void {
  try {
    window.localStorage.removeItem(GUEST_FLAG_KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}
