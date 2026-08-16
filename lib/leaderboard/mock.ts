import type { LeaderboardEntry } from './types';

// Two-letter monogram from the last two syllables of a Vietnamese given-name-last
// full name (e.g. "Lê Thị Hồng Vân" -> "HV", not "LT"). The roster below ships
// literal `initials` so a future rename of a mock learner can't silently change
// their monogram — this helper exists for symmetry and is covered by a test that
// checks it against a few roster entries.
export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/);
  const lastTwo = parts.slice(-2);
  return lastTwo.map((p) => p.charAt(0).toUpperCase()).join('');
}

// 20 hand-authored, frozen learners — no PRNG, no generator, so every number is a
// literal a reviewer can read in the diff and a test can assert invariants over
// (lib/leaderboard/__tests__/mock.test.ts). Stats are hand-correlated so they read
// as one plausible roster instead of random noise:
//   - totalReviews ≈ words × 3..9
//   - accuracy roughly in [0.71, 0.93], drifting up with level
//   - longestStreak × 2 ≤ totalReviews (can't hold a long streak on few reviews)
//   - newLast7 ≤ min(words, 30), inversely related to tenure
//   - leechesConquered ≤ floor(words × 0.15)
// Every entry has `isMe: false` — the real user's row is built separately by
// buildMyEntry() (metrics.ts) and injected at rank time, never stored here.
export const MOCK_ROSTER: readonly LeaderboardEntry[] = Object.freeze([
  {
    id: 'lb-01', name: 'Nguyễn Minh Anh', initials: 'MA', level: 'C1', isMe: false,
    words: 512, longestStreak: 96, totalReviews: 3180, totalCorrect: 2830,
    newLast7: 14, leechesConquered: 45,
    sampleWords: ['nuanced', 'pragmatic', 'intricate', 'unprecedented', 'discretion', 'paradigm', 'meticulous', 'holistic', 'discern', 'tenuous', 'conducive', 'inherent'],
  },
  {
    id: 'lb-02', name: 'Trần Quốc Bảo', initials: 'QB', level: 'C1', isMe: false,
    words: 470, longestStreak: 88, totalReviews: 4230, totalCorrect: 3722,
    newLast7: 10, leechesConquered: 34,
    sampleWords: ['ambiguous', 'cohesive', 'paradigm', 'meticulous', 'discern', 'tenuous', 'conducive', 'inherent', 'nuanced', 'intricate'],
  },
  {
    id: 'lb-03', name: 'Lê Thị Hồng Vân', initials: 'HV', level: 'C2', isMe: false,
    words: 604, longestStreak: 118, totalReviews: 4120, totalCorrect: 3790,
    newLast7: 6, leechesConquered: 41,
    sampleWords: ['ubiquitous', 'paradoxical', 'esoteric', 'quintessential', 'juxtapose', 'ephemeral', 'magnanimous', 'vindicate', 'circumvent', 'ostensible', 'cogent', 'ineffable', 'perspicacious'],
  },
  {
    id: 'lb-04', name: 'Phạm Gia Huy', initials: 'GH', level: 'B2', isMe: false,
    words: 356, longestStreak: 45, totalReviews: 2210, totalCorrect: 1860,
    newLast7: 11, leechesConquered: 28,
    sampleWords: ['leverage', 'contingency', 'robust', 'scalable', 'mitigate', 'procurement', 'discrepancy', 'compliance', 'escalate', 'bottleneck'],
  },
  {
    id: 'lb-05', name: 'Đỗ Ngọc Lan', initials: 'NL', level: 'B2', isMe: false,
    words: 312, longestStreak: 38, totalReviews: 1840, totalCorrect: 1520,
    newLast7: 17, leechesConquered: 19,
    sampleWords: ['synergy', 'benchmark', 'robust', 'mitigate', 'compliance', 'escalate', 'throughput', 'redundancy', 'contingency'],
  },
  {
    id: 'lb-06', name: 'Vũ Thanh Tùng', initials: 'TT', level: 'B1', isMe: false,
    words: 210, longestStreak: 152, totalReviews: 890, totalCorrect: 690,
    newLast7: 4, leechesConquered: 14,
    sampleWords: ['strategy', 'implement', 'efficient', 'collaborate', 'stakeholder', 'initiative', 'streamline', 'feasible', 'allocate'],
  },
  {
    id: 'lb-07', name: 'Hoàng Bích Ngọc', initials: 'BN', level: 'B2', isMe: false,
    words: 298, longestStreak: 52, totalReviews: 1620, totalCorrect: 1310,
    newLast7: 9, leechesConquered: 21,
    sampleWords: ['leverage', 'synergy', 'benchmark', 'robust', 'scalable', 'compliance', 'bottleneck', 'throughput'],
  },
  {
    id: 'lb-08', name: 'Bùi Đăng Khoa', initials: 'ĐK', level: 'B1', isMe: false,
    words: 176, longestStreak: 31, totalReviews: 980, totalCorrect: 740,
    newLast7: 21, leechesConquered: 11,
    sampleWords: ['implement', 'collaborate', 'initiative', 'feasible', 'allocate', 'forecast', 'onboarding', 'workflow'],
  },
  {
    id: 'lb-09', name: 'Đặng Thu Hà', initials: 'TH', level: 'B1', isMe: false,
    words: 245, longestStreak: 44, totalReviews: 1380, totalCorrect: 1080,
    newLast7: 13, leechesConquered: 16,
    sampleWords: ['strategy', 'efficient', 'stakeholder', 'streamline', 'allocate', 'forecast', 'milestone', 'turnover', 'workflow'],
  },
  {
    id: 'lb-10', name: 'Ngô Xuân Mai', initials: 'XM', level: 'A2', isMe: false,
    words: 112, longestStreak: 18, totalReviews: 610, totalCorrect: 460,
    newLast7: 22, leechesConquered: 8,
    sampleWords: ['budget', 'deadline', 'invoice', 'client', 'feedback', 'presentation', 'negotiate', 'agenda'],
  },
  {
    id: 'lb-11', name: 'Trịnh Công Danh', initials: 'CD', level: 'B2', isMe: false,
    words: 289, longestStreak: 19, totalReviews: 1580, totalCorrect: 1290,
    newLast7: 27, leechesConquered: 15,
    sampleWords: ['leverage', 'synergy', 'contingency', 'procurement', 'discrepancy', 'compliance', 'escalate', 'redundancy', 'benchmark', 'throughput'],
  },
  {
    id: 'lb-12', name: 'Lý Thảo Nhi', initials: 'TN', level: 'A2', isMe: false,
    words: 98, longestStreak: 22, totalReviews: 520, totalCorrect: 484,
    newLast7: 19, leechesConquered: 9,
    sampleWords: ['deadline', 'presentation', 'agenda', 'deliver', 'warranty', 'refund', 'priority', 'complaint'],
  },
  {
    id: 'lb-13', name: 'Phan Anh Tuấn', initials: 'AT', level: 'C1', isMe: false,
    words: 445, longestStreak: 61, totalReviews: 2870, totalCorrect: 2490,
    newLast7: 8, leechesConquered: 30,
    sampleWords: ['ambiguous', 'intricate', 'unprecedented', 'discretion', 'cohesive', 'holistic', 'discern', 'tenuous', 'inherent'],
  },
  {
    id: 'lb-14', name: 'Vương Kim Chi', initials: 'KC', level: 'B1', isMe: false,
    words: 189, longestStreak: 27, totalReviews: 940, totalCorrect: 710,
    newLast7: 16, leechesConquered: 12,
    sampleWords: ['strategy', 'implement', 'collaborate', 'initiative', 'feasible', 'onboarding', 'milestone'],
  },
  {
    id: 'lb-15', name: 'Đinh Hải Yến', initials: 'HY', level: 'A2', isMe: false,
    words: 134, longestStreak: 24, totalReviews: 720, totalCorrect: 560,
    newLast7: 20, leechesConquered: 10,
    sampleWords: ['budget', 'deadline', 'client', 'presentation', 'negotiate', 'deliver', 'discount', 'refund'],
  },
  {
    id: 'lb-16', name: 'Cao Minh Đức', initials: 'MĐ', level: 'B2', isMe: false,
    words: 267, longestStreak: 44, totalReviews: 1490, totalCorrect: 1190,
    newLast7: 12, leechesConquered: 18,
    sampleWords: ['leverage', 'robust', 'scalable', 'mitigate', 'procurement', 'discrepancy', 'escalate', 'bottleneck'],
  },
  {
    id: 'lb-17', name: 'Tô Bảo Trân', initials: 'BT', level: 'A1', isMe: false,
    words: 42, longestStreak: 9, totalReviews: 210, totalCorrect: 150,
    newLast7: 15, leechesConquered: 3,
    sampleWords: ['hello', 'name', 'work', 'meeting', 'email', 'phone'],
  },
  {
    id: 'lb-18', name: 'Mai Thành Long', initials: 'TL', level: 'B1', isMe: false,
    words: 210, longestStreak: 29, totalReviews: 1120, totalCorrect: 830,
    newLast7: 18, leechesConquered: 13,
    sampleWords: ['efficient', 'collaborate', 'stakeholder', 'streamline', 'feasible', 'forecast', 'turnover', 'workflow'],
  },
  {
    id: 'lb-19', name: 'Dương Thảo Vy', initials: 'TV', level: 'A2', isMe: false,
    words: 87, longestStreak: 14, totalReviews: 460, totalCorrect: 350,
    newLast7: 13, leechesConquered: 6,
    sampleWords: ['invoice', 'feedback', 'agenda', 'priority', 'complaint', 'warranty'],
  },
  {
    id: 'lb-20', name: 'Chu Nhật Nam', initials: 'NN', level: 'A1', isMe: false,
    words: 31, longestStreak: 11, totalReviews: 118, totalCorrect: 88,
    newLast7: 9, leechesConquered: 2,
    sampleWords: ['hello', 'name', 'office', 'colleague', 'schedule'],
  },
] as const);
