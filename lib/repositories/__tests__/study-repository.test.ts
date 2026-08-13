import { beforeEach, describe, expect, it } from 'vitest';
import { resetDbForTests, USER_ID } from '@/lib/db/dexie';
import { toRow } from '@/lib/db/rows';
import { createDexieWordRepository } from '../dexie/word-repository';
import { createDexieStudyRepository } from '../dexie/study-repository';
import { DEFAULT_SETTINGS, DEFAULT_STATS } from '../dexie/user-repository';
import type { Word } from '@/lib/domain';

// docs/decision.md ADR-005 — recordReview is a single Dexie transaction over
// word + review + user. These tests exercise it against fake-indexeddb (a real
// IndexedDB implementation, not a mock), so they catch real transaction bugs.
describe('StudyRepository.recordReview', () => {
  beforeEach(() => {
    resetDbForTests();
  });

  it('moves word, review, and stats together on a correct answer', async () => {
    const db = resetDbForTests();
    const now = Date.UTC(2026, 0, 1, 12);
    const word: Word = {
      id: 'w1', word: 'mitigate', ipa: '', partOfSpeech: 'verb', meaningVi: '',
      exampleSentence: 'Mitigate the risk.', distractors: ['a', 'b', 'c'],
      collocations: [], wordFamily: [], source: { kind: 'manual', label: '', at: now },
      audioUrl: null, createdAt: now, dueAt: now, easeLevel: 0, reviewCount: 0,
      lapseCount: 0, consecutiveCorrect: 0, isLeech: false, status: 'new',
    };
    await db.words.add(toRow(word, now));
    await db.user.add({ id: USER_ID, settings: DEFAULT_SETTINGS, stats: DEFAULT_STATS, updatedAt: now });

    const study = createDexieStudyRepository();
    const result = await study.recordReview({ wordId: 'w1', kind: 'fillBlank', correct: true, now, sessionId: 's1' });

    expect(result.word.easeLevel).toBe(1);
    expect(result.word.reviewCount).toBe(1);
    expect(result.stats.totalReviews).toBe(1);
    expect(result.stats.totalCorrect).toBe(1);
    expect(result.review.wordId).toBe('w1');
    expect(result.review.correct).toBe(true);

    // Every read comes fresh from the DB, not from the returned result — proves the
    // transaction actually persisted, not just returned an in-memory computation.
    const persistedWord = await db.words.get('w1');
    expect(persistedWord?.easeLevel).toBe(1);
    const persistedReviews = await db.reviews.toArray();
    expect(persistedReviews).toHaveLength(1);
    const persistedUser = await db.user.get(USER_ID);
    expect(persistedUser?.stats.totalReviews).toBe(1);
  });

  it('throws and writes nothing when the word does not exist', async () => {
    const db = resetDbForTests();
    const study = createDexieStudyRepository();
    await expect(
      study.recordReview({ wordId: 'missing', kind: 'fillBlank', correct: true, now: Date.now(), sessionId: 's1' }),
    ).rejects.toThrow();
    expect(await db.reviews.count()).toBe(0);
  });

  it('two sequential reviews both land — no lost update from a stale in-memory copy', async () => {
    // This is the shape of bug the old WordsContext had: recordReview mutated a
    // React-state copy of `stats` rather than reading fresh from storage each time.
    const db = resetDbForTests();
    const now = Date.UTC(2026, 0, 1, 12);
    const word: Word = {
      id: 'w1', word: 'x', ipa: '', partOfSpeech: '', meaningVi: '', exampleSentence: '',
      distractors: [], collocations: [], wordFamily: [], source: { kind: 'manual', label: '', at: now },
      audioUrl: null, createdAt: now, dueAt: now, easeLevel: 0, reviewCount: 0,
      lapseCount: 0, consecutiveCorrect: 0, isLeech: false, status: 'new',
    };
    await db.words.add(toRow(word, now));
    await db.user.add({ id: USER_ID, settings: DEFAULT_SETTINGS, stats: DEFAULT_STATS, updatedAt: now });

    const study = createDexieStudyRepository();
    await study.recordReview({ wordId: 'w1', kind: 'fillBlank', correct: true, now, sessionId: 's1' });
    await study.recordReview({ wordId: 'w1', kind: 'listen', correct: false, now: now + 1000, sessionId: 's1' });

    const persistedUser = await db.user.get(USER_ID);
    expect(persistedUser?.stats.totalReviews).toBe(2);
    expect(persistedUser?.stats.totalCorrect).toBe(1);
  });
});

describe('StudyRepository session persistence', () => {
  beforeEach(() => {
    resetDbForTests();
  });

  it('loadActiveSession finds an active session for the given day and ignores done ones', async () => {
    const study = createDexieStudyRepository();
    await study.saveSession({
      id: 's1', createdAt: 1, dayKey: '2026-01-01', items: [], index: 0, answers: {}, status: 'active',
    });
    await study.saveSession({
      id: 's2', createdAt: 2, dayKey: '2026-01-01', items: [], index: 5, answers: {}, status: 'done',
    });

    const active = await study.loadActiveSession('2026-01-01');
    expect(active?.id).toBe('s1');

    const none = await study.loadActiveSession('2026-01-02');
    expect(none).toBeNull();
  });

  it('saveSession overwrites the same session id (resume mid-session keeps one row)', async () => {
    const db = resetDbForTests();
    const study = createDexieStudyRepository();
    await study.saveSession({ id: 's1', createdAt: 1, dayKey: '2026-01-01', items: [], index: 0, answers: {}, status: 'active' });
    await study.saveSession({ id: 's1', createdAt: 1, dayKey: '2026-01-01', items: [], index: 3, answers: {}, status: 'active' });

    expect(await db.studySessions.count()).toBe(1);
    const loaded = await study.loadActiveSession('2026-01-01');
    expect(loaded?.index).toBe(3);
  });
});

describe('WordRepository duplicate handling', () => {
  beforeEach(() => {
    resetDbForTests();
  });

  it('adding the same word twice (case-insensitive) returns the existing row, not a duplicate', async () => {
    const repo = createDexieWordRepository();
    const first = await repo.add({ word: 'Leverage', source: { kind: 'manual', label: '', at: Date.now() } });
    const second = await repo.add({ word: 'leverage', source: { kind: 'manual', label: '', at: Date.now() } });
    expect(second.id).toBe(first.id);

    const all = await repo.list({ limit: 100 });
    expect(all.filter((w) => w.word.toLowerCase() === 'leverage')).toHaveLength(1);
  });

  it('addMany de-dupes within a single batch', async () => {
    const repo = createDexieWordRepository();
    const now = Date.now();
    const results = await repo.addMany([
      { word: 'leverage', source: { kind: 'paste', label: 'x', at: now } },
      { word: 'leverage', source: { kind: 'paste', label: 'x', at: now } },
    ]);
    expect(results[0]!.id).toBe(results[1]!.id);
  });
});

// docs/decision.md ADR-014's load-bearing claim: nextSchedule/recordReview are
// entity-agnostic — they operate on the SrsState-shaped fields of a Word row and
// never inspect `entryType`, so a saved phrase is scheduled through the exact same
// code path as a plain word, with zero changes to StudyRepository.
describe('StudyRepository.recordReview schedules a phrase entryType identically to a plain word', () => {
  beforeEach(() => {
    resetDbForTests();
  });

  it('produces the same easeLevel/dueAt/reviewCount progression for both', async () => {
    const db = resetDbForTests();
    const now = Date.UTC(2026, 0, 1, 12);
    const base = {
      ipa: '', partOfSpeech: '', meaningVi: '', exampleSentence: 'x', distractors: ['a', 'b', 'c'],
      collocations: [], wordFamily: [], source: { kind: 'manual' as const, label: '', at: now },
      audioUrl: null, createdAt: now, dueAt: now, easeLevel: 0, reviewCount: 0,
      lapseCount: 0, consecutiveCorrect: 0, isLeech: false, status: 'new' as const,
    };
    await db.words.add(toRow({ ...base, id: 'plain_word', word: 'mitigate' }, now));
    await db.words.add(
      toRow({ ...base, id: 'saved_phrase', word: 'extend the deadline', entryType: 'phrase', noteVi: 'x' }, now),
    );
    await db.user.add({ id: USER_ID, settings: DEFAULT_SETTINGS, stats: DEFAULT_STATS, updatedAt: now });

    const study = createDexieStudyRepository();
    const wordResult = await study.recordReview({ wordId: 'plain_word', kind: 'fillBlank', correct: true, now, sessionId: 's1' });
    const phraseResult = await study.recordReview({ wordId: 'saved_phrase', kind: 'fillBlank', correct: true, now, sessionId: 's1' });

    expect(phraseResult.word.easeLevel).toBe(wordResult.word.easeLevel);
    expect(phraseResult.word.dueAt).toBe(wordResult.word.dueAt);
    expect(phraseResult.word.reviewCount).toBe(wordResult.word.reviewCount);
    expect(phraseResult.word.entryType).toBe('phrase'); // the tag itself survives the round trip
  });
});
