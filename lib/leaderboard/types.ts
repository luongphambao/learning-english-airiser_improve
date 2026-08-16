import type { Cefr } from '@/lib/domain';

// One row on the board. The mock roster (mock.ts) stores these fields directly;
// the current user's row is derived from real UserStats + real Word rows by
// buildMyEntry() in metrics.ts.
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
  // their full vocabulary (that would mean literally enumerating 600+ words per
  // mock learner). Lets a row expand to show real-looking content instead of just
  // numbers. For the real user's row this is a genuine subset of their notebook.
  sampleWords: readonly string[];
}

export type LeaderboardMetricId =
  | 'words'
  | 'longestStreak'
  | 'totalReviews'
  | 'accuracy'
  | 'newLast7'
  | 'leechesConquered';

export interface MetricConfig {
  id: LeaderboardMetricId;
  label: string; // chip label
  hint: string; // one line shown under the podium
  valueOf: (entry: LeaderboardEntry) => number; // higher is always better
  format: (entry: LeaderboardEntry) => string;
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
