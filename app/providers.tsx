'use client';

import { useEffect, useState } from 'react';
import { migrateFromLocalStorage, seedIfEmpty } from '@/lib/db/migrate-local-storage';
import { useThemeSync } from '@/hooks/use-theme';

/**
 * Runs once per app load, before rendering any screen: import the legacy
 * localStorage blob into Dexie (idempotent — see lib/db/migrate-local-storage.ts),
 * then seed the 5 demo words if the notebook is still empty. Replaces
 * context/WordsContext.tsx as the root provider (docs/decision.md ADR / Phase 5).
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
        await seedIfEmpty(now);
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
  // localStorage data still being imported.
  if (!ready) return null;
  return <>{children}</>;
}
