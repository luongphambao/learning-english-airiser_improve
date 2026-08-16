// Pure mapping between LeaderboardEntry (what the UI renders) and LeaderboardDoc
// (what's actually written to/read from Firestore's `leaderboard/{uid}` — see
// lib/leaderboard/remote.ts for the I/O boundary that calls this). Kept
// Firebase-free so it stays node-testable like the rest of lib/leaderboard/**.

import { safeParseRow } from '@/lib/db/read';
import { LeaderboardDocSchema, type LeaderboardDoc, type LeaderboardEntry } from './types';
import { initialsFromName } from './name';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/** Strips everything a LeaderboardEntry carries that must never leave the device —
 * `sampleWords` (a slice of the user's actual notebook) chief among them — down to
 * the flat, aggregate-only shape firestore.rules validates on write. */
export function toLeaderboardDoc(entry: LeaderboardEntry, uid: string, now: number): LeaderboardDoc {
  return {
    uid,
    name: entry.name,
    level: entry.level,
    words: entry.words,
    longestStreak: entry.longestStreak,
    totalReviews: entry.totalReviews,
    totalCorrect: entry.totalCorrect,
    newLast7: entry.newLast7,
    leechesConquered: entry.leechesConquered,
    updatedAt: now,
  };
}

/**
 * Turns one raw Firestore document into a LeaderboardEntry, or null if it doesn't
 * parse (a doc written by a future/incompatible client version — same
 * safeParseRow-and-drop convention lib/sync/engine.ts uses for remote rows,
 * except there's no local table to quarantine into here, so an unparseable doc is
 * just silently excluded from the board rather than crashing it).
 *
 * `newLast7` decay: this field is computed against the PUBLISHER's clock at
 * publish time, then never updates again until they publish again. A learner who
 * stops studying would otherwise show a frozen "new this week" count forever. If
 * the doc hasn't been touched in at least 7 days, nothing they added could still
 * be within the last 7 days, so `newLast7` is forced to 0 — exact at that
 * boundary, and deliberately not attempting to interpolate for anything in
 * between (see docs/decision.md ADR-025 for why that's accepted, same spirit as
 * lib/leaderboard/metrics.ts's isConqueredHardWord over-count).
 */
export function entryFromDoc(raw: unknown, myUid: string | null, now: number): LeaderboardEntry | null {
  const parsed = safeParseRow(LeaderboardDocSchema, raw);
  if (!parsed.ok) return null;
  const doc = parsed.value;

  const stale = now - doc.updatedAt >= SEVEN_DAYS_MS;

  return {
    id: doc.uid,
    name: doc.name,
    initials: initialsFromName(doc.name),
    level: doc.level,
    isMe: doc.uid === myUid,
    words: doc.words,
    longestStreak: doc.longestStreak,
    totalReviews: doc.totalReviews,
    totalCorrect: doc.totalCorrect,
    newLast7: stale ? 0 : doc.newLast7,
    leechesConquered: doc.leechesConquered,
    sampleWords: [], // never published — see LeaderboardEntry.sampleWords's doc comment
  };
}
