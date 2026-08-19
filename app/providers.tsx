'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { migrateFromLocalStorage } from '@/lib/db/migrate-local-storage';
import { setActiveUser } from '@/lib/db/dexie';
import { resetRepos } from '@/lib/repositories';
import { establishServerSession, subscribeAuthState } from '@/lib/auth/firebase-auth';
import { exitGuestMode, isGuestMode } from '@/lib/auth/guest';
import { getFirebaseAuth } from '@/lib/firebase/client';
import { AccessProvider, type AccessMode } from '@/hooks/use-access';
import { useThemeSync } from '@/hooks/use-theme';
import { AppBootSkeleton } from '@/components/layout/app-boot-skeleton';
import { LegacyClaimBanner } from '@/components/layout/legacy-claim-banner';
import { SyncScheduler } from '@/components/layout/sync-scheduler';
import { MascotOverlay } from '@/components/mascot/MascotOverlay';

/** No account and no guest mode — the visitor is sent to the login screen. */
type Access = AccessMode | 'locked';

/** The only route reachable while locked; gating it would hide the way back in. */
const PUBLIC_PATHS = new Set(['/login']);

/**
 * Runs once per app load, before rendering any screen: subscribes to Firebase
 * auth state and points the app's Dexie connection at the right database for
 * whoever's signed in (setActiveUser() in lib/db/dexie.ts — `lexio:<uid>` per
 * account, or the pre-account `lexio` database when signed out), then imports
 * the legacy localStorage blob (idempotent — see lib/db/migrate-local-storage.ts).
 * Replaces context/WordsContext.tsx as the root provider (docs/decision.md ADR /
 * Phase 5).
 *
 * Also the app's login gate. It is the single choke point every route already
 * passes through, so no middleware is needed. Access is granted by a live
 * Firebase client session, OR by the server's own `lexio_user_session` cookie
 * without one (which is what keeps the Playwright scripts in scripts/*.mjs
 * working), OR by guest mode — see lib/auth/guest.ts for why a guest is a client
 * flag rather than a Firebase anonymous account.
 *
 * Deliberately does NOT call seedIfEmpty() anymore (docs/decision.md ADR-017): that
 * auto-seeded 5 fixed demo words into ANY empty notebook on every load, which raced
 * the new placement-test onboarding (app/(stack)/placement/page.tsx,
 * app/(tabs)/today/page.tsx's `!hasNotebook` branch) and always won — a real user
 * would never see the placement CTA, because the notebook stopped being empty within
 * ~1s of the page loading. seedIfEmpty() itself is left in place (and still tested)
 * as a manual fallback, not an automatic one.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [access, setAccess] = useState<Access>('locked');
  const pathname = usePathname();
  const router = useRouter();
  useThemeSync();

  const resolveAccessWithoutFirebase = useCallback(async (): Promise<Access> => {
    if (isGuestMode()) return 'guest';
    try {
      const res = await fetch('/api/auth/me');
      if (!res.ok) return 'locked';
      const data = await res.json();
      return data?.authenticated ? 'account' : 'locked';
    } catch {
      return 'locked';
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Every Firebase auth callback — the first one on load (resolving whatever
    // session Firebase already has cached), and every subsequent sign-in/
    // sign-out/account-switch — repoints Dexie at the right database and
    // drops the memoized repositories so getRepos() picks it up (see
    // setActiveUser()'s doc comment for why resetRepos() must follow it).
    const unsubscribe = subscribeAuthState(async (user) => {
      const now = Date.now();
      setActiveUser(user?.uid ?? null);
      resetRepos();

      let nextAccess: Access = 'account';

      if (user) {
        // A real account supersedes guest mode, so the restricted state never
        // lingers after someone signs up from inside the demo.
        exitGuestMode();
        // Fire-and-forget: keeps the server session cookie (used by
        // server-side routes like /api/gmail/send-reminder) fresh across
        // reloads and token refreshes. Never blocks readiness — sync/Dexie
        // work client-side even if this fails (see app/api/auth/session's
        // comment on Admin SDK being optional).
        void establishServerSession(user);
      } else {
        nextAccess = await resolveAccessWithoutFirebase();
        // Signed-out / local-only path — unchanged from before accounts
        // existed: import the pre-Dexie localStorage blob into the local
        // `lexio` database exactly once. A signed-in account does NOT
        // re-run this against its own per-account database — inheriting old
        // data for a signed-in account goes through the explicit,
        // interactive claim-legacy flow instead (lib/db/claim-legacy.ts +
        // components/layout/legacy-claim-banner.tsx), never automatically.
        // The legacy `lexio` database that flow copies from already contains
        // anything this migration would have pulled in during this device's
        // earlier signed-out use, so nothing is lost by skipping it here.
        try {
          await migrateFromLocalStorage(now);
        } catch (err) {
          console.error('[lexio] startup migration failed:', err);
        }
      }

      if (!cancelled) {
        setUid(user?.uid ?? null);
        setAccess(nextAccess);
        setReady(true);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [resolveAccessWithoutFirebase]);

  // Entering guest mode and signing out both change access without any Firebase
  // auth-state callback firing, so they announce themselves on the same event the
  // header already listens to (components/layout/app-header.tsx).
  useEffect(() => {
    async function onAuthChanged() {
      if (getFirebaseAuth().currentUser) return; // the subscription above owns this case
      setAccess(await resolveAccessWithoutFirebase());
    }
    window.addEventListener('lexio-auth-changed', onAuthChanged);
    return () => window.removeEventListener('lexio-auth-changed', onAuthChanged);
  }, [resolveAccessWithoutFirebase]);

  const locked = ready && access === 'locked' && !PUBLIC_PATHS.has(pathname);

  useEffect(() => {
    if (locked) router.replace('/login');
  }, [locked, router]);

  // Every screen already has its own loading state for its own data (useLiveQuery
  // resolves to undefined until Dexie answers); this only guards the one-time
  // migration so a fresh page load doesn't briefly race an empty notebook against
  // localStorage data still being imported. Previously `return null` here — a
  // genuine blank white screen on every cold load, since no route-level
  // loading.tsx can reach this (Providers is a client component already mounted
  // inside the rendered layout by the time this effect runs).
  if (!ready || locked) return <AppBootSkeleton />;

  return (
    // key={uid} remounts the whole subtree on sign-in/out/account-switch, so
    // every useLiveQuery-backed hook re-subscribes against the newly active
    // database instead of holding stale results from the previous account.
    <AccessProvider value={access === 'guest' ? 'guest' : 'account'}>
      <Fragment key={uid ?? 'anon'}>
        {uid && <LegacyClaimBanner />}
        {uid && <SyncScheduler />}
        {children}
        {/* Guests get the dragon too (docs/decision.md ADR-030) — unlike the two
            rows above, it's not account-specific, so it isn't gated on `uid`. */}
        <MascotOverlay />
      </Fragment>
    </AccessProvider>
  );
}
