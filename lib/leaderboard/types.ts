import { z } from 'zod';
import { CefrSchema, type Cefr } from '@/lib/domain';

// One row on the board. Every entry besides the current user's is now built from a
// real LeaderboardDoc pulled from Firestore (lib/leaderboard/map.ts's
// entryFromDoc()); the current user's row is derived from real UserStats + real
// Word rows by buildMyEntry() in metrics.ts (docs/decision.md ADR-025).
export interface LeaderboardEntry {
  id: string;
  name: string;
  initials: string; // two-letter monogram — no image, no network request
  level: Cefr;
  isMe: boolean;
  words: number;
  longestStreak: number;
  totalReviews: number;
  totalCorrect: number;
  newLast7: number; // words created in the last 7 Asia/Ho_Chi_Minh calendar days
  leechesConquered: number;
  // A representative sample of words this learner is currently studying — NOT
  // their full vocabulary. For the current user's own row this is a genuine subset
  // of their notebook. Every OTHER row always gets `[]`: a learner's vocabulary is
  // never published to Firestore (ADR-025 privacy decision), so there is nothing
  // real to show, and rank-row.tsx already renders a non-expandable row when this
  // is empty.
  sampleWords: readonly string[];
}

// The document shape at `leaderboard/{uid}` on Firestore — deliberately narrower
// than LeaderboardEntry: no email, no settings, no sampleWords. Matches the shape
// firestore.rules validates on write; keep the two in sync if a field is added.
export const LeaderboardDocSchema = z.object({
  uid: z.string().min(1),
  name: z.string().min(1).max(40),
  level: CefrSchema,
  words: z.number().int().min(0),
  longestStreak: z.number().int().min(0),
  totalReviews: z.number().int().min(0),
  totalCorrect: z.number().int().min(0),
  newLast7: z.number().int().min(0),
  leechesConquered: z.number().int().min(0),
  // Client `Date.now()` at publish time — same convention as every other synced
  // row (docs/decision.md ADR-004), never a Firestore serverTimestamp().
  updatedAt: z.number(),
});
export type LeaderboardDoc = z.infer<typeof LeaderboardDocSchema>;

export type LeaderboardMetricId =
  | 'words'
  | 'longestStreak'
  | 'totalReviews'
  | 'accuracy'
  | 'newLast7'
  | 'leechesConquered';

// Matches useT()'s `t` return type (hooks/use-i18n.ts) without importing the hook
// here — this file must stay hook-free so lib/leaderboard/** keeps working under a
// plain node vitest environment.
export type Translate = (key: string, vars?: Record<string, string | number>) => string;

export interface MetricConfig {
  id: LeaderboardMetricId;
  labelKey: string; // i18n key for chip label
  hintKey: string; // i18n key for the one line shown under the podium
  valueOf: (entry: LeaderboardEntry) => number; // higher is always better
  format: (entry: LeaderboardEntry, t: Translate) => string;
  // Entries failing this sort below every qualified entry and render "—".
  // Only the 'accuracy' metric uses it.
  qualifies?: (entry: LeaderboardEntry) => boolean;
}

export interface RankedEntry {
  entry: LeaderboardEntry;
  rank: number; // competition ranking (1, 2, 2, 4) — ties share a rank
  value: number;
  qualified: boolean;
}
