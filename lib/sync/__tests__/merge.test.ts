import { describe, expect, it } from 'vitest';
import { mergeById, mergeSkipped, mergeUserRow, mergeWords, recomputeStatsFromReviews } from '../merge';
import type { GrammarAttemptRow, ImportRow, ReviewRow, SkippedRow, WordRow } from '../types';
import type { UserRow } from '@/lib/db/dexie';

const D0 = Date.UTC(2026, 5, 10, 12);
const D1 = D0 + 1000;
const D2 = D0 + 2000;

function word(overrides: Partial<WordRow> = {}): WordRow {
  return {
    id: 'w1',
    word: 'mitigate',
    wordLower: 'mitigate',
    ipa: '',
    partOfSpeech: '',
    meaningVi: '',
    exampleSentence: '',
    distractors: [],
    collocations: [],
    wordFamily: [],
    source: { kind: 'manual', label: '', at: D0 },
    audioUrl: null,
    createdAt: D0,
    dueAt: D0,
    easeLevel: 0,
    reviewCount: 0,
    lapseCount: 0,
    consecutiveCorrect: 0,
    isLeech: 0,
    status: 'new',
    updatedAt: D0,
    deletedAt: null,
    entryType: 'word',
    noteVi: '',
    originalText: null,
    cefr: 'unknown',
    ...overrides,
  };
}

describe('mergeById (reviews/imports/grammarAttempts)', () => {
  it('unions rows present on only one side', () => {
    const local: ReviewRow[] = [
      { id: 'r1', wordId: 'w1', kind: 'recall', correct: true, answeredAt: D0, sessionId: 's1', dayKey: '2026-06-10', updatedAt: D0 },
    ];
    const remote: ReviewRow[] = [
      { id: 'r2', wordId: 'w1', kind: 'recall', correct: false, answeredAt: D1, sessionId: 's1', dayKey: '2026-06-10', updatedAt: D1 },
    ];
    const merged = mergeById(local, remote);
    expect(merged.map((r) => r.id).sort()).toEqual(['r1', 'r2']);
  });

  it('last-write-wins by updatedAt on a same-id conflict', () => {
    const local: ImportRow[] = [
      { id: 'imp1', fileName: 'a.pdf', kind: 'pdf', createdAt: D0, status: 'ready', candidates: [], addedCount: 0, error: null, analysis: null, updatedAt: D0 },
    ];
    const remote: ImportRow[] = [
      { id: 'imp1', fileName: 'a.pdf', kind: 'pdf', createdAt: D0, status: 'done', candidates: [], addedCount: 3, error: null, analysis: null, updatedAt: D1 },
    ];
    const merged = mergeById(local, remote);
    expect(merged).toHaveLength(1);
    expect(merged[0].status).toBe('done');
    expect(merged[0].addedCount).toBe(3);
  });

  it('an older remote write never overwrites a newer local one', () => {
    const local: GrammarAttemptRow[] = [{ id: 'ga1', topicId: 't1', score: 4, total: 5, at: D1, updatedAt: D1 }];
    const remote: GrammarAttemptRow[] = [{ id: 'ga1', topicId: 't1', score: 2, total: 5, at: D0, updatedAt: D0 }];
    const merged = mergeById(local, remote);
    expect(merged[0].score).toBe(4);
  });
});

describe('mergeSkipped', () => {
  it('a tombstone (un-skip) beats an older non-deleted remote row', () => {
    const local: SkippedRow[] = [{ wordLower: 'deadline', word: 'deadline', at: D0, deletedAt: D1, updatedAt: D1 }];
    const remote: SkippedRow[] = [{ wordLower: 'deadline', word: 'deadline', at: D0, deletedAt: null, updatedAt: D0 }];
    const merged = mergeSkipped(local, remote);
    expect(merged[0].deletedAt).toBe(D1);
  });

  it('a newer remote re-skip beats an older local tombstone', () => {
    const local: SkippedRow[] = [{ wordLower: 'deadline', word: 'deadline', at: D0, deletedAt: D1, updatedAt: D1 }];
    const remote: SkippedRow[] = [{ wordLower: 'deadline', word: 'deadline', at: D2, deletedAt: null, updatedAt: D2 }];
    const merged = mergeSkipped(local, remote);
    expect(merged[0].deletedAt).toBeNull();
  });
});

describe('mergeWords', () => {
  it('a brand-new remote word (no local id or wordLower match) is just added', () => {
    const local = [word({ id: 'w1', wordLower: 'mitigate' })];
    const remote = [word({ id: 'w2', word: 'bottleneck', wordLower: 'bottleneck' })];
    const { toPersist, toPush } = mergeWords(local, remote, D2);
    expect(toPersist.map((w) => w.id)).toContain('w2');
    expect(toPush).toHaveLength(0); // ordinary new word, not a dedupe resolution
  });

  it('same id on both sides: LWW, remote wins when newer', () => {
    const local = [word({ id: 'w1', reviewCount: 1, updatedAt: D0 })];
    const remote = [word({ id: 'w1', reviewCount: 5, updatedAt: D1 })];
    const { toPersist } = mergeWords(local, remote, D2);
    expect(toPersist).toHaveLength(1);
    expect(toPersist[0].reviewCount).toBe(5);
  });

  it('same id on both sides: local wins when remote is stale', () => {
    const local = [word({ id: 'w1', reviewCount: 5, updatedAt: D1 })];
    const remote = [word({ id: 'w1', reviewCount: 1, updatedAt: D0 })];
    const { toPersist } = mergeWords(local, remote, D2);
    expect(toPersist[0].reviewCount).toBe(5);
  });

  it('dedupes two independently-created rows sharing a wordLower: earlier createdAt wins the id, SRS state merges via max()', () => {
    const local = [word({ id: 'local-id', wordLower: 'mitigate', createdAt: D0, reviewCount: 3, lapseCount: 1, dueAt: D1, consecutiveCorrect: 2, isLeech: 0, updatedAt: D0 })];
    const remote = [word({ id: 'remote-id', wordLower: 'mitigate', createdAt: D1, reviewCount: 1, lapseCount: 4, dueAt: D2, consecutiveCorrect: 0, isLeech: 1, updatedAt: D1 })];

    const { toPersist, toPush } = mergeWords(local, remote, D2);

    // The earlier-created row (local, createdAt D0) stays canonical.
    const canonical = toPersist.find((w) => w.id === 'local-id')!;
    expect(canonical).toBeTruthy();
    expect(canonical.deletedAt).toBeNull();
    expect(canonical.reviewCount).toBe(3); // max(3, 1)
    expect(canonical.lapseCount).toBe(4); // max(1, 4)
    expect(canonical.dueAt).toBe(D2); // max(D1, D2)
    expect(canonical.consecutiveCorrect).toBe(2); // max(2, 0)
    expect(canonical.isLeech).toBe(1); // either side's leech flag sticks

    // The later-created row is tombstoned, not silently dropped — a
    // dangling review.wordId pointing at it must still resolve to a real row.
    const loser = toPersist.find((w) => w.id === 'remote-id')!;
    expect(loser).toBeTruthy();
    expect(loser.deletedAt).toBe(D2);

    // Both sides of the resolution must be pushed — Firestore/the other
    // device don't know about this collision until told.
    expect(toPush.map((w) => w.id).sort()).toEqual(['local-id', 'remote-id']);
  });

  it('does not treat a collision with an already-tombstoned local word as a dedupe case', () => {
    const local = [word({ id: 'local-id', wordLower: 'mitigate', deletedAt: D0, updatedAt: D0 })];
    const remote = [word({ id: 'remote-id', wordLower: 'mitigate', createdAt: D1, updatedAt: D1 })];
    const { toPersist, toPush } = mergeWords(local, remote, D2);
    // Just an ordinary new word — the deleted local row isn't a dedupe target.
    expect(toPersist.map((w) => w.id)).toEqual(['remote-id']);
    expect(toPush).toHaveLength(0);
  });

  it('a third colliding row resolves against the just-merged canonical, not the stale pre-merge local row', () => {
    const local = [word({ id: 'local-id', wordLower: 'mitigate', createdAt: D0, reviewCount: 1, updatedAt: D0 })];
    const remote = [
      word({ id: 'remote-a', wordLower: 'mitigate', createdAt: D1, reviewCount: 5, updatedAt: D1 }),
      word({ id: 'remote-b', wordLower: 'mitigate', createdAt: D2, reviewCount: 9, updatedAt: D2 }),
    ];
    const { toPersist } = mergeWords(local, remote, D2 + 1000);
    const canonical = toPersist.find((w) => w.id === 'local-id')!;
    // Both remote-a and remote-b folded into the same canonical local-id row.
    expect(canonical.reviewCount).toBe(9); // max(1, 5, 9)
    const tombstoned = toPersist.filter((w) => w.deletedAt !== null).map((w) => w.id).sort();
    expect(tombstoned).toEqual(['remote-a', 'remote-b']);
  });
});

describe('recomputeStatsFromReviews', () => {
  it('folds a merged review set into the same stats nextStats() would produce sequentially', () => {
    const DAY_MS = 86_400_000;
    const reviews = [
      { correct: true, answeredAt: D0 },
      { correct: true, answeredAt: D0 + DAY_MS },
      { correct: false, answeredAt: D0 + 2 * DAY_MS },
    ];
    const stats = recomputeStatsFromReviews(reviews);
    expect(stats.totalReviews).toBe(3);
    expect(stats.totalCorrect).toBe(2);
    expect(stats.daysStudied).toBe(3);
    expect(stats.streak).toBe(3);
  });

  it('is order-independent — merging local+remote reviews in either order gives the same stats', () => {
    const DAY_MS = 86_400_000;
    const a = { correct: true, answeredAt: D0 };
    const b = { correct: true, answeredAt: D0 + DAY_MS };
    const c = { correct: false, answeredAt: D0 + 2 * DAY_MS };
    const forward = recomputeStatsFromReviews([a, b, c]);
    const shuffled = recomputeStatsFromReviews([c, a, b]);
    expect(shuffled).toEqual(forward);
  });

  it('two devices each logging independent reviews since last sync sum losslessly (the reason stats are recomputed, not LWW/maxed)', () => {
    const DAY_MS = 86_400_000;
    // Device A logs 2 reviews on day 0, device B logs 3 reviews on day 1 —
    // neither device's local `totalReviews` (2 or 3) is the true merged
    // total; only folding the unioned review set gets to 5.
    const deviceAReviews = [
      { correct: true, answeredAt: D0 },
      { correct: true, answeredAt: D0 + 60_000 },
    ];
    const deviceBReviews = [
      { correct: true, answeredAt: D0 + DAY_MS },
      { correct: false, answeredAt: D0 + DAY_MS + 60_000 },
      { correct: true, answeredAt: D0 + DAY_MS + 120_000 },
    ];
    const merged = recomputeStatsFromReviews([...deviceAReviews, ...deviceBReviews]);
    expect(merged.totalReviews).toBe(5);
    expect(merged.totalCorrect).toBe(4);
  });
});

describe('mergeUserRow', () => {
  function userRow(overrides: Partial<UserRow> = {}): UserRow {
    return {
      id: 'local',
      settings: {
        reminderHour: null,
        studyTime: null,
        theme: 'system',
        locale: 'vi',
        contextTopic: 'general',
        level: 'B1',
        sessionSize: 5,
        leaderboardName: null,
        levelProfile: { declared: null, placement: null, work: null, srs: null, updatedAt: null, lastPromptedAt: null },
      },
      stats: { streak: 0, longestStreak: 0, lastStudiedOn: null, freezeUsedOn: null, totalReviews: 0, totalCorrect: 0, daysStudied: 0, history: {} },
      updatedAt: D0,
      ...overrides,
    };
  }

  it('settings LWW: newer remote settings win, but stats always come from the caller-supplied recompute', () => {
    const local = userRow({ updatedAt: D0, settings: { ...userRow().settings, contextTopic: 'local-topic' } });
    const remote = userRow({ updatedAt: D1, settings: { ...userRow().settings, contextTopic: 'remote-topic' } });
    const recomputedStats = { ...userRow().stats, totalReviews: 42 };

    const merged = mergeUserRow(local, remote, recomputedStats, D2);
    expect(merged.settings.contextTopic).toBe('remote-topic');
    expect(merged.stats.totalReviews).toBe(42);
    expect(merged.updatedAt).toBe(D2);
  });

  it('settings LWW: older remote settings lose to local', () => {
    const local = userRow({ updatedAt: D1, settings: { ...userRow().settings, contextTopic: 'local-topic' } });
    const remote = userRow({ updatedAt: D0, settings: { ...userRow().settings, contextTopic: 'remote-topic' } });
    const merged = mergeUserRow(local, remote, userRow().stats, D2);
    expect(merged.settings.contextTopic).toBe('local-topic');
  });
});
