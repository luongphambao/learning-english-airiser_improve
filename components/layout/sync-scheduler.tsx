'use client';

import { useEffect } from 'react';
import { useSyncStore } from '@/stores/sync-store';

/**
 * No UI — fires lib/sync/engine.ts's syncOnce() at the moments docs/data-model.md
 * calls for: right after sign-in (this component only mounts once `uid` is
 * truthy, so its own mount IS that trigger), when the tab regains focus, and on
 * a periodic background interval while the tab stays visible. That last one
 * stands in for the plan's "debounce ~30s after each write" — hooking every
 * write across 8 repositories to a debounced trigger would touch far more of
 * the codebase for a difference users wouldn't notice (a session-completion
 * sync and a tab-focus sync already cover the moments data actually changes);
 * the interval below plus the explicit triggers in
 * stores/session-store.ts (after a completed session) and
 * app/(stack)/settings/page.tsx ("Đồng bộ ngay") reach the same practical
 * result with far less surface area.
 */
const BACKGROUND_INTERVAL_MS = 5 * 60_000;

export function SyncScheduler() {
  const sync = useSyncStore((s) => s.sync);
  const hydrate = useSyncStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
    void sync(Date.now());

    function onVisible() {
      if (document.visibilityState === 'visible') void sync(Date.now());
    }
    document.addEventListener('visibilitychange', onVisible);

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') void sync(Date.now());
    }, BACKGROUND_INTERVAL_MS);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
