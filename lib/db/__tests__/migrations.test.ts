// @vitest-environment jsdom
// localStorage only exists under a DOM environment — the rest of the suite runs
// under `node` for speed; this file opts into jsdom just for itself.
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb, resetDbForTests, LexioDb, USER_ID } from '@/lib/db/dexie';
import { migrateFromLocalStorage, seedIfEmpty } from '../migrate-local-storage';

const BASE_TIME = 1738800000000; // the frozen timestamp the old TodayScreen bug used

describe('migrateFromLocalStorage', () => {
  beforeEach(() => {
    resetDbForTests();
    localStorage.clear();
  });

  it('imports words, stats, and settings from the legacy localStorage keys', async () => {
    localStorage.setItem(
      'lexio_words',
      JSON.stringify([
        {
          id: 'w1', word: 'trade-off', ipa: '/ˈtreɪd ɒf/', partOfSpeech: 'noun',
          meaningVi: 'Sự đánh đổi', exampleSentence: 'A trade-off between speed and safety.',
          distractors: ['a', 'b', 'c'], collocations: [], wordFamily: [],
          source: { kind: 'manual', label: 'Tự thêm', at: BASE_TIME },
          audioUrl: null, createdAt: BASE_TIME, dueAt: BASE_TIME - 1000,
          easeLevel: 1, reviewCount: 2, lapseCount: 0, isLeech: false, status: 'learning',
          // no consecutiveCorrect/updatedAt/deletedAt — this is the pre-ADR-007 shape
        },
      ]),
    );
    localStorage.setItem(
      'lexio_stats',
      JSON.stringify({
        streak: 3, longestStreak: 5, lastStudiedOn: null, freezeUsedOn: null,
        totalReviews: 14, totalCorrect: 12, daysStudied: 3, history: {},
      }),
    );
    localStorage.setItem(
      'lexio_settings',
      JSON.stringify({ reminderHour: 8, studyTime: '08:00', theme: 'light', contextTopic: 'finance', level: 'B2' }),
    );

    const result = await migrateFromLocalStorage(BASE_TIME);
    expect(result.migrated).toBe(true);
    expect(result.wordCount).toBe(1);

    const db = getDb();
    const row = await db.words.get('w1');
    expect(row).toBeTruthy();
    expect(row?.consecutiveCorrect).toBe(0); // repaired default, not lost
    expect(row?.dueAt).toBe(BASE_TIME - 1000); // NOT touched by repair — see comment in migrate-local-storage.ts

    const user = await db.user.get(USER_ID);
    expect(user?.stats.totalReviews).toBe(14);
    expect(user?.settings.contextTopic).toBe('finance');
  });

  it('is idempotent — running twice does not duplicate data', async () => {
    localStorage.setItem(
      'lexio_words',
      JSON.stringify([
        {
          id: 'w1', word: 'x', ipa: '', partOfSpeech: 'noun', meaningVi: '', exampleSentence: '',
          distractors: [], collocations: [], wordFamily: [], source: { kind: 'manual', label: '', at: 0 },
          audioUrl: null, createdAt: 0, dueAt: 0, easeLevel: 0, reviewCount: 0, lapseCount: 0,
          isLeech: false, status: 'new',
        },
      ]),
    );

    const first = await migrateFromLocalStorage(BASE_TIME);
    const second = await migrateFromLocalStorage(BASE_TIME);
    expect(first.migrated).toBe(true);
    expect(second.migrated).toBe(false);

    const db = getDb();
    expect(await db.words.count()).toBe(1);
  });

  it('quarantines a corrupt entry instead of throwing or silently dropping it unnoticed', async () => {
    localStorage.setItem('lexio_words', JSON.stringify([{ id: 'bad', word: 123 /* wrong type */ }]));

    const result = await migrateFromLocalStorage(BASE_TIME);
    expect(result.wordCount).toBe(0); // the bad row did not get imported as a Word

    const db = getDb();
    const quarantined = await db.meta.get('quarantine:words:bad');
    expect(quarantined).toBeTruthy();
  });

  it('does not delete the original localStorage keys', async () => {
    localStorage.setItem('lexio_words', JSON.stringify([]));
    await migrateFromLocalStorage(BASE_TIME);
    expect(localStorage.getItem('lexio_words')).not.toBeNull();
  });
});

describe('v2 -> v3 upgrade (docs/decision.md ADR-014)', () => {
  const DB_NAME = 'lexio-test-v2-to-v3-upgrade';

  it('backfills entryType on a pre-v3 word row, and it becomes findable via the new index', async () => {
    // Declare ONLY v1+v2 — exactly what a real pre-upgrade browser's IndexedDB
    // already contains. Copied verbatim from lib/db/dexie.ts's v1/v2 blocks; must
    // stay verbatim, since this test's whole point is exercising the real upgrade
    // path a live v1/v2 database would go through, not a schema this test invents.
    const legacyDb = new Dexie(DB_NAME);
    legacyDb.version(1).stores({
      words: 'id, &wordLower, dueAt, createdAt, status, [status+createdAt], [isLeech+dueAt], updatedAt',
      reviews: 'id, wordId, answeredAt, dayKey, [wordId+answeredAt]',
      user: 'id',
      studySessions: 'id, dayKey, status',
      tutorSessions: 'id, startsAt, status',
      imports: 'id, createdAt, status',
      skipped: '&wordLower, at',
      meta: 'key',
    });
    legacyDb.version(2).stores({ grammarAttempts: 'id, topicId, at' });
    await legacyDb.open();

    const now = Date.UTC(2026, 5, 1);
    await legacyDb.table('words').add({
      id: 'legacy_w1', word: 'legacy', ipa: '', partOfSpeech: '', meaningVi: '', exampleSentence: '',
      distractors: [], collocations: [], wordFamily: [], source: { kind: 'manual', label: '', at: now },
      audioUrl: null, createdAt: now, dueAt: now, easeLevel: 0, reviewCount: 0, lapseCount: 0,
      consecutiveCorrect: 0, isLeech: 0, status: 'new', updatedAt: now, deletedAt: null,
      wordLower: 'legacy',
      // deliberately no entryType/noteVi/originalText — the pre-v3 shape
    });
    legacyDb.close();

    // Reopen the SAME database name through the real LexioDb — this runs the
    // actual version(3).upgrade() defined in lib/db/dexie.ts, not a copy of it.
    const upgraded = new LexioDb(DB_NAME);
    await upgraded.open();

    const row = await upgraded.words.get('legacy_w1');
    expect(row?.entryType).toBe('word');
    expect(row?.noteVi).toBe('');
    expect(row?.originalText).toBeNull();

    // The failure mode this backfill exists to prevent: IndexedDB omits a record
    // from an index entirely when its key path is undefined at index-creation
    // time. If the upgrade() had been skipped, this word would exist in the table
    // but be invisible here — a silently empty result, not a thrown error.
    const foundByIndex = await upgraded.words.where('entryType').equals('word').toArray();
    expect(foundByIndex.map((w) => w.id)).toContain('legacy_w1');

    upgraded.close();
    await Dexie.delete(DB_NAME);
  });
});

describe('v3 -> v4 upgrade (docs/decision.md ADR-016/017)', () => {
  const DB_NAME = 'lexio-test-v3-to-v4-upgrade';

  it('backfills cefr on a pre-v4 word row and levelProfile/sessionSize on the user row', async () => {
    // Declare v1+v2+v3 verbatim (copied from lib/db/dexie.ts) — exactly what a real
    // pre-v4 browser's IndexedDB already contains. The point of this test is
    // exercising the real upgrade() a live v3 database goes through, not a schema
    // this test invents.
    const legacyDb = new Dexie(DB_NAME);
    legacyDb.version(1).stores({
      words: 'id, &wordLower, dueAt, createdAt, status, [status+createdAt], [isLeech+dueAt], updatedAt',
      reviews: 'id, wordId, answeredAt, dayKey, [wordId+answeredAt]',
      user: 'id',
      studySessions: 'id, dayKey, status',
      tutorSessions: 'id, startsAt, status',
      imports: 'id, createdAt, status',
      skipped: '&wordLower, at',
      meta: 'key',
    });
    legacyDb.version(2).stores({ grammarAttempts: 'id, topicId, at' });
    legacyDb.version(3).stores({
      words:
        'id, &wordLower, dueAt, createdAt, status, [status+createdAt], [isLeech+dueAt], updatedAt, entryType, [entryType+dueAt]',
    });
    await legacyDb.open();

    const now = Date.UTC(2026, 5, 1);
    await legacyDb.table('words').add({
      id: 'legacy_w2', word: 'legacy2', ipa: '', partOfSpeech: '', meaningVi: '', exampleSentence: '',
      distractors: [], collocations: [], wordFamily: [], source: { kind: 'manual', label: '', at: now },
      audioUrl: null, createdAt: now, dueAt: now, easeLevel: 0, reviewCount: 0, lapseCount: 0,
      consecutiveCorrect: 0, isLeech: 0, status: 'new', updatedAt: now, deletedAt: null,
      wordLower: 'legacy2', entryType: 'word', noteVi: '', originalText: null,
      // deliberately no cefr — the pre-v4 shape
    });
    await legacyDb.table('user').add({
      id: USER_ID,
      settings: {
        reminderHour: null, studyTime: null, theme: 'system', contextTopic: 'finance', level: 'B2',
        // deliberately no sessionSize/levelProfile — the pre-v4 shape
      },
      stats: {
        streak: 0, longestStreak: 0, lastStudiedOn: null, freezeUsedOn: null,
        totalReviews: 0, totalCorrect: 0, daysStudied: 0, history: {},
      },
      updatedAt: now,
    });
    legacyDb.close();

    // Reopen the SAME database name through the real LexioDb — runs the actual
    // version(4).upgrade() defined in lib/db/dexie.ts, not a copy of it.
    const upgraded = new LexioDb(DB_NAME);
    await upgraded.open();

    const row = await upgraded.words.get('legacy_w2');
    expect(row?.cefr).toBe('unknown');

    // The failure mode this backfill exists to prevent: IndexedDB omits a record
    // from an index entirely when its key path is undefined at index-creation
    // time. If upgrade() had been skipped, this word would be invisible here.
    const foundByIndex = await upgraded.words.where('cefr').equals('unknown').toArray();
    expect(foundByIndex.map((w) => w.id)).toContain('legacy_w2');

    const user = await upgraded.user.get(USER_ID);
    expect(user?.settings.sessionSize).toBe(5);
    expect(user?.settings.levelProfile).toEqual({
      declared: null, placement: null, work: null, srs: null, updatedAt: null, lastPromptedAt: null,
    });
    // Pre-v4 fields survive the merge untouched.
    expect(user?.settings.contextTopic).toBe('finance');

    upgraded.close();
    await Dexie.delete(DB_NAME);
  });
});

describe('v4 -> v5 upgrade (lib/sync/** delta-sync cursor fields)', () => {
  const DB_NAME = 'lexio-test-v4-to-v5-upgrade';

  it('indexes reviews.updatedAt and backfills updatedAt on imports/grammarAttempts and deletedAt+updatedAt on skipped', async () => {
    // Declare v1-v4 verbatim (copied from lib/db/dexie.ts) — exactly what a real
    // pre-v5 browser's IndexedDB already contains. The point of this test is
    // exercising the real version(5).upgrade() a live v4 database goes through,
    // not a schema this test invents.
    const legacyDb = new Dexie(DB_NAME);
    legacyDb.version(1).stores({
      words: 'id, &wordLower, dueAt, createdAt, status, [status+createdAt], [isLeech+dueAt], updatedAt',
      reviews: 'id, wordId, answeredAt, dayKey, [wordId+answeredAt]',
      user: 'id',
      studySessions: 'id, dayKey, status',
      tutorSessions: 'id, startsAt, status',
      imports: 'id, createdAt, status',
      skipped: '&wordLower, at',
      meta: 'key',
    });
    legacyDb.version(2).stores({ grammarAttempts: 'id, topicId, at' });
    legacyDb.version(3).stores({
      words:
        'id, &wordLower, dueAt, createdAt, status, [status+createdAt], [isLeech+dueAt], updatedAt, entryType, [entryType+dueAt]',
    });
    legacyDb.version(4).stores({
      words:
        'id, &wordLower, dueAt, createdAt, status, [status+createdAt], [isLeech+dueAt], updatedAt, entryType, [entryType+dueAt], cefr, [cefr+status]',
    });
    await legacyDb.open();

    const now = Date.UTC(2026, 5, 1);
    await legacyDb.table('reviews').add({
      id: 'r_legacy', wordId: 'legacy_w2', kind: 'recall', correct: true, answeredAt: now,
      sessionId: 's_legacy', dayKey: '2026-06-01', updatedAt: now,
      // reviews always set updatedAt (study-repository.ts) — this row exercises
      // that the NEW index actually finds it, not a backfill (there is none).
    });
    await legacyDb.table('imports').add({
      id: 'imp_legacy', fileName: 'doc.pdf', kind: 'pdf', createdAt: now, status: 'ready',
      candidates: [], addedCount: 0, error: null,
      // deliberately no updatedAt — the pre-v5 shape
    });
    await legacyDb.table('skipped').add({
      wordLower: 'legacy-skip', word: 'legacy-skip', at: now,
      // deliberately no deletedAt/updatedAt — the pre-v5 shape
    });
    await legacyDb.table('grammarAttempts').add({
      id: 'ga_legacy', topicId: 'present-simple', score: 3, total: 5, at: now,
      // deliberately no updatedAt — the pre-v5 shape
    });
    legacyDb.close();

    // Reopen the SAME database name through the real LexioDb — runs the actual
    // version(5).upgrade() defined in lib/db/dexie.ts, not a copy of it.
    const upgraded = new LexioDb(DB_NAME);
    await upgraded.open();

    const importRow = await upgraded.imports.get('imp_legacy');
    expect(importRow?.updatedAt).toBe(now);

    const skippedRow = await upgraded.skipped.get('legacy-skip');
    expect(skippedRow?.deletedAt).toBeNull();
    expect(skippedRow?.updatedAt).toBe(now);

    const attemptRow = await upgraded.grammarAttempts.get('ga_legacy');
    expect(attemptRow?.updatedAt).toBe(now);

    // The failure mode this backfill exists to prevent: a sync delta query
    // (`where('updatedAt').above(cursor)`) would silently skip any row whose
    // `updatedAt` key path is undefined, without erroring — matching the same
    // "invisible until backfilled" risk v3/v4's tests guard against.
    const foundByIndex = await upgraded.imports.where('updatedAt').equals(now).toArray();
    expect(foundByIndex.map((r) => r.id)).toContain('imp_legacy');

    // reviews' `updatedAt` index is new in v5 too (the field existed since
    // v1, but nothing indexed it) — confirm the index itself resolves, not
    // just that the field is present on the row.
    const reviewsByIndex = await upgraded.reviews.where('updatedAt').equals(now).toArray();
    expect(reviewsByIndex.map((r) => r.id)).toContain('r_legacy');

    upgraded.close();
    await Dexie.delete(DB_NAME);
  });
});

describe('seedIfEmpty', () => {
  beforeEach(() => {
    resetDbForTests();
    localStorage.clear();
  });

  it('seeds 5 demo words with dueAt = now (not a frozen timestamp) when the notebook is empty', async () => {
    const now = Date.UTC(2026, 5, 1);
    const seeded = await seedIfEmpty(now);
    expect(seeded).toBe(true);

    const db = getDb();
    const words = await db.words.toArray();
    expect(words).toHaveLength(5);
    for (const w of words) expect(w.dueAt).toBe(now);
  });

  it('does not reseed after the seeded words are deleted', async () => {
    const now = Date.UTC(2026, 5, 1);
    await seedIfEmpty(now);
    const db = getDb();
    await db.words.clear();

    const seededAgain = await seedIfEmpty(now + 1000);
    expect(seededAgain).toBe(false);
    expect(await db.words.count()).toBe(0);
  });

  it('does not seed if the notebook already has words (e.g. from migration)', async () => {
    const db = getDb();
    const now = Date.UTC(2026, 5, 1);
    await db.words.add({
      id: 'w1', word: 'x', ipa: '', partOfSpeech: '', meaningVi: '', exampleSentence: '',
      distractors: [], collocations: [], wordFamily: [], source: { kind: 'manual', label: '', at: now },
      audioUrl: null, createdAt: now, dueAt: now, easeLevel: 0, reviewCount: 0, lapseCount: 0,
      consecutiveCorrect: 0, isLeech: 0, status: 'new', updatedAt: now, deletedAt: null,
      wordLower: 'x', entryType: 'word', noteVi: '', originalText: null, cefr: 'unknown',
    });

    const seeded = await seedIfEmpty(now);
    expect(seeded).toBe(false);
    expect(await db.words.count()).toBe(1);
  });
});
