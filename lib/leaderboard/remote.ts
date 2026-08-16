import { collection, doc, getDocs, limit as fsLimit, orderBy, query, setDoc, type Firestore } from 'firebase/firestore';
import type { LeaderboardDoc } from './types';

/**
 * I/O boundary for the leaderboard — talks to Firestore's top-level `leaderboard`
 * collection, nothing else. Same split as lib/sync/firestore.ts: this file only
 * knows how to read/write plain objects; lib/leaderboard/publish.ts (the write
 * side) and hooks/use-leaderboard.ts (the read side) own the decisions about
 * when/what to call it with. One doc per uid — `setDoc()`, not `addDoc()` /
 * `updateDoc()`, so a republish always overwrites the same doc rather than
 * accumulating history (there's no leaderboard history feature — ADR-025 keeps
 * this to "who's active now", not a timeline).
 */

const COLLECTION = 'leaderboard';

export async function publishEntry(db: Firestore, entry: LeaderboardDoc): Promise<void> {
  await setDoc(doc(db, COLLECTION, entry.uid), entry);
}

/**
 * Most-recently-published first, capped at `limitCount` — see
 * lib/leaderboard/metrics.ts's buildLeaderboard doc comment for why "most
 * recently active" is the right cut for a bounded board rather than an arbitrary
 * one, and docs/decision.md ADR-025 for why this is disclosed in the UI. A single
 * `orderBy('updatedAt')` needs no composite index (firestore.indexes.json stays
 * empty) — ranking by every other metric happens client-side via rankBy().
 */
export async function fetchRecentDocs(db: Firestore, limitCount: number): Promise<unknown[]> {
  const q = query(collection(db, COLLECTION), orderBy('updatedAt', 'desc'), fsLimit(limitCount));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}
