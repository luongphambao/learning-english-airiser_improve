'use client';

import { useEffect, useState } from 'react';
import { migrateFromLocalStorage } from '@/lib/db/migrate-local-storage';
import { useThemeSync } from '@/hooks/use-theme';
import { AppBootSkeleton } from '@/components/layout/app-boot-skeleton';

/**
 * Runs once per app load, before rendering any screen: import the legacy
 * localStorage blob into Dexie (idempotent — see lib/db/migrate-local-storage.ts).
 * Replaces context/WordsContext.tsx as the root provider (docs/decision.md ADR /
 * Phase 5).
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
  useThemeSync();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const now = Date.now();
      try {
        await migrateFromLocalStorage(now);
      } catch (err) {
        console.error('[lexio] startup migration/seed failed:', err);
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Every screen already has its own loading state for its own data (useLiveQuery
  // resolves to undefined until Dexie answers); this only guards the one-time
  // migration so a fresh page load doesn't briefly race an empty notebook against
  // localStorage data still being imported. Previously `return null` here — a
  // genuine blank white screen on every cold load, since no route-level
  // loading.tsx can reach this (Providers is a client component already mounted
  // inside the rendered layout by the time this effect runs).
  if (!ready) return <AppBootSkeleton />;
  return <>{children}</>;
}
