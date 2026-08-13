import { beforeEach, describe, expect, it } from 'vitest';
import { resetDbForTests } from '@/lib/db/dexie';
import { createDexieWordRepository } from '../dexie/word-repository';

// docs/decision.md ADR-014 — addFromInsight is the "Học từ công việc thật" save
// path: a saved phrase/grammar-fix becomes a `words` row with `entryType` set,
// scheduled like a fresh applyTriage('unknown', ...) word (dueAt=now).
describe('WordRepository.addFromInsight', () => {
  beforeEach(() => {
    resetDbForTests();
  });

  it('creates a new word row scheduled due immediately, tagged with entryType', async () => {
    const words = createDexieWordRepository();
    const now = Date.UTC(2026, 0, 1, 12);

    const saved = await words.addFromInsight({
      text: 'extend the deadline',
      entryType: 'phrase',
      source: { kind: 'paste', label: 'Công việc: email.txt', at: now },
      meaningVi: 'gia hạn thời hạn',
      noteVi: 'Lời đề nghị lịch sự khi xin thêm thời gian',
      exampleSentence: 'Would it be possible to extend the deadline until Friday?',
      distractors: ['delay the deadline', 'push the deadline', 'move the deadline'],
      originalText: null,
      now,
    });

    expect(saved.word).toBe('extend the deadline');
    expect(saved.entryType).toBe('phrase');
    expect(saved.dueAt).toBe(now);
    expect(saved.easeLevel).toBe(0);
    expect(saved.status).toBe('new');
    expect(saved.reviewCount).toBe(0);
  });

  it('re-saving an already-practiced item updates content but PRESERVES its SRS schedule', async () => {
    const words = createDexieWordRepository();
    const t0 = Date.UTC(2026, 0, 1, 12);

    const first = await words.addFromInsight({
      text: 'circle back',
      entryType: 'phrase',
      source: { kind: 'paste', label: 'Công việc: a.txt', at: t0 },
      meaningVi: 'quay lại bàn tiếp',
      noteVi: 'usage v1',
      exampleSentence: "Let's circle back on this next week.",
      distractors: ['follow up', 'touch base', 'check in'],
      originalText: null,
      now: t0,
    });

    // Simulate practice having moved it on: advance the schedule directly, the
    // way StudyRepository.recordReview would after a correct answer.
    const practiced = await words.patch(first.id, { easeLevel: 2, reviewCount: 3, dueAt: t0 + 7 * 86_400_000 });
    expect(practiced.dueAt).toBeGreaterThan(t0);

    // Re-save the SAME phrase from a second analysis, later.
    const t1 = t0 + 30 * 86_400_000;
    const resaved = await words.addFromInsight({
      text: 'circle back', // same wordLower -> same row
      entryType: 'phrase',
      source: { kind: 'paste', label: 'Công việc: b.txt', at: t1 },
      meaningVi: 'quay lại bàn tiếp (updated)',
      noteVi: 'usage v2',
      exampleSentence: "I'll circle back with the team.",
      distractors: ['loop back', 'follow up', 'reconnect'],
      originalText: null,
      now: t1,
    });

    expect(resaved.id).toBe(first.id); // same row, not a duplicate
    // Content refreshed...
    expect(resaved.meaningVi).toBe('quay lại bàn tiếp (updated)');
    expect(resaved.exampleSentence).toBe("I'll circle back with the team.");
    // ...but the SRS schedule earned by practice was NOT reset.
    expect(resaved.dueAt).toBe(practiced.dueAt);
    expect(resaved.easeLevel).toBe(2);
    expect(resaved.reviewCount).toBe(3);
  });

  it('list({entryType}) filters phrases out of the plain word list and vice versa', async () => {
    const words = createDexieWordRepository();
    const now = Date.UTC(2026, 0, 1, 12);

    await words.add({ word: 'mitigate', source: { kind: 'manual', label: '', at: now } });
    await words.addFromInsight({
      text: 'extend the deadline',
      entryType: 'phrase',
      source: { kind: 'paste', label: '', at: now },
      meaningVi: '', noteVi: '', exampleSentence: '', distractors: [], originalText: null, now,
    });

    const onlyWords = await words.list({ entryType: 'word', limit: 50 });
    const onlyPhrases = await words.list({ entryType: 'phrase', limit: 50 });

    expect(onlyWords.map((w) => w.word)).toEqual(['mitigate']);
    expect(onlyPhrases.map((w) => w.word)).toEqual(['extend the deadline']);
  });
});
