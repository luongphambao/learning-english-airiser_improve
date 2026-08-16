import { create } from 'zustand';
import { getRepos } from '@/lib/repositories';
import { getFirebaseAuth } from '@/lib/firebase/client';
import { syncOnce } from '@/lib/sync/engine';
import { publishLeaderboard } from '@/lib/leaderboard/publish';
import type { SyncStatus } from '@/lib/sync/types';

// docs/data-model.md §5 / lib/sync/** — orchestrator-only store (reads/writes via
// getRepos() + lib/sync/engine.ts, presents no domain logic of its own), same
// convention as stores/level-store.ts and stores/topup-store.ts.

const LAST_SYNCED_KEY = 'sync:lastSyncedAt';

interface SyncStoreState {
  status: SyncStatus;
  lastSyncedAt: number | null;
  error: string | null;
  /** Reads the last-synced timestamp from `meta` once, so Settings can show
   * "Đồng bộ lúc HH:mm" immediately on load instead of waiting for the next
   * automatic sync trigger to fire. Safe to call more than once. */
  hydrate(): Promise<void>;
  /**
   * Runs one sync round for whichever account is currently signed in — reads
   * the uid itself from Firebase Auth rather than making every call site look
   * it up, since this is called from several independent, unrelated triggers
   * (app/providers.tsx on sign-in and tab focus, stores/session-store.ts
   * after a completed session, app/(stack)/settings/page.tsx's "Đồng bộ
   * ngay" button). No-ops silently when signed out (nothing to sync — the
   * app must keep working fully offline/signed-out, docs/data-model.md) or
   * when the browser reports it's offline (status: 'offline'). Sync is
   * always best-effort; Dexie stays authoritative regardless
   * (lib/sync/engine.ts's own doc comment).
   */
  sync(now: number): Promise<void>;
}

export const useSyncStore = create<SyncStoreState>()((set, get) => ({
  status: 'idle',
  lastSyncedAt: null,
  error: null,

  async hydrate() {
    if (get().lastSyncedAt !== null) return;
    const stored = await getRepos().meta.get<number>(LAST_SYNCED_KEY);
    if (stored !== undefined) set({ lastSyncedAt: stored });
  },

  async sync(now) {
    const uid = getFirebaseAuth().currentUser?.uid;
    if (!uid) return;
    if (get().status === 'syncing') return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      set({ status: 'offline' });
      return;
    }

    set({ status: 'syncing', error: null });
    const result = await syncOnce({ uid, now });

    if (result.ok) {
      await getRepos().meta.put(LAST_SYNCED_KEY, result.syncedAt);
      set({ status: 'idle', lastSyncedAt: result.syncedAt, error: null });
      // Best-effort and independent of sync's own status: a leaderboard publish
      // failure (e.g. the shape/range validation in firestore.rules rejecting a
      // stale write) must never flip the sync UI to an error state — the user's
      // real data already synced fine (docs/decision.md ADR-025).
      try {
        await publishLeaderboard(now);
      } catch (err) {
        console.error('[lexio] leaderboard publish failed:', err);
      }
    } else {
      set({ status: 'error', error: result.error ?? 'Đồng bộ thất bại.' });
    }
  },
}));
