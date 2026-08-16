import type { GrammarAttemptRow, ImportRow, ReviewRow, SkippedRow, UserRow } from '@/lib/db/dexie';
import type { WordRow } from '@/lib/db/rows';

/**
 * Firestore documents mirror the local Dexie row shapes exactly — no separate
 * wire format. Every row already carries `updatedAt` (the delta-sync cursor
 * field, ADR-004: always a client `Date.now()`, never `serverTimestamp()`)
 * and, where relevant, a `deletedAt` tombstone, so nothing needs translating
 * at the Firestore boundary. See docs/data-model.md §5 for the collection
 * layout this assumes: `users/{uid}/words/{id}`, `.../reviews/{id}`,
 * `.../imports/{id}`, `.../skipped/{wordLower}`, `.../grammarAttempts/{id}`,
 * plus the `users/{uid}` doc itself for settings+stats.
 */
export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

/** One row's worth of sync bookkeeping per collection, persisted in the local
 * `meta` table (MetaRepository, key `sync:cursor:<collection>`) — never a new
 * Dexie table, per the same "meta is already a generic KV store" reasoning
 * meta-repository.ts already documents for the corpus top-up throttle. */
export interface SyncCursor {
  /** Highest remote `updatedAt` already pulled into this device. */
  pulledAt: number;
  /** Highest local `updatedAt` already pushed from this device. */
  pushedAt: number;
}

export const SYNCED_COLLECTIONS = ['words', 'reviews', 'imports', 'skipped', 'grammarAttempts'] as const;
export type SyncedCollection = (typeof SYNCED_COLLECTIONS)[number];

export interface SyncCounts {
  words: number;
  reviews: number;
  imports: number;
  skipped: number;
  grammarAttempts: number;
}

export interface SyncResult {
  ok: boolean;
  syncedAt: number;
  pushed: Partial<SyncCounts>;
  pulled: Partial<SyncCounts>;
  error?: string;
}

/** The `users/{uid}` Firestore doc — settings+stats bundled under one
 * `updatedAt`, same as the local `user` table's singleton row (UserRow). */
export interface UserSyncDoc {
  email: string;
  displayName?: string;
  settings: UserRow['settings'];
  stats: UserRow['stats'];
  updatedAt: number;
}

export type { WordRow, ReviewRow, ImportRow, SkippedRow, GrammarAttemptRow };
