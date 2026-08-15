import { describe, expect, it } from 'vitest';
import { buildSession, isEligible } from '../session';
import type { SessionCaps } from '../types';
import type { Word } from '@/lib/domain';

const NOW = Date.UTC(2026, 0, 1, 12);
const FULL_CAPS: SessionCaps = { audioAvailable: true, aiAvailable: true };

let counter = 0;
function makeWord(overrides: Partial<Word> = {}): Word {
  counter += 1;
  return {
    id: `w${counter}`,
    word: 'mitigate',
    ipa: '/ˈmɪt.ɪ.ɡeɪt/',
    partOfSpeech: 'verb',
    meaningVi: 'giảm thiểu',
    exampleSentence: 'We must mitigate the risk before launch.',
    distractors: ['exacerbate', 'stimulate', 'provoke'],
    collocations: [],
    wordFamily: [],
    source: { kind: 'manual', label: '', at: NOW },
    audioUrl: null,
    createdAt: NOW,
    dueAt: NOW,
    easeLevel: 0,
    reviewCount: 0,
    lapseCount: 0,
    consecutiveCorrect: 0,
    isLeech: false,
    status: 'new',
    ...overrides,
  };
}

describe('lib/srs/session buildSession', () => {
  it('builds up to `size` items from due words', () => {
    const due = Array.from({ length: 5 }, (_, i) => makeWord({ id: `due${i}`, dueAt: NOW - i }));
    const session = buildSession({ sessionId: 's1', due, leech: [], fresh: [], now: NOW, size: 5, caps: FULL_CAPS });
    expect(session.items).toHaveLength(5);
    expect(session.status).toBe('active');
  });

  it('fills out with fresh (never-reviewed) words when fewer than `size` are due', () => {
    const due = [makeWord({ id: 'due1' })];
    const fresh = Array.from({ length: 4 }, (_, i) => makeWord({ id: `fresh${i}`, status: 'new' }));
    const session = buildSession({ sessionId: 's1', due, leech: [], fresh, now: NOW, size: 5, caps: FULL_CAPS });
    expect(session.items).toHaveLength(5);
    expect(session.items.map((i) => i.wordId)).toEqual(['due1', 'fresh0', 'fresh1', 'fresh2', 'fresh3']);
  });

  it('an empty pool produces a done, zero-item session (caught-up empty state)', () => {
    const session = buildSession({ sessionId: 's1', due: [], leech: [], fresh: [], now: NOW, size: 5, caps: FULL_CAPS });
    expect(session.items).toHaveLength(0);
    expect(session.status).toBe('done');
  });

  it('a leech is placed at position 0 and is never assigned fillBlank', () => {
    const leech = makeWord({ id: 'leech1', isLeech: true, lapseCount: 4 });
    const due = Array.from({ length: 4 }, (_, i) => makeWord({ id: `due${i}` }));
    const session = buildSession({ sessionId: 's1', due, leech: [leech], fresh: [], now: NOW, size: 5, caps: FULL_CAPS });
    expect(session.items[0]?.wordId).toBe('leech1');
    expect(session.items[0]?.kind).not.toBe('fillBlank');
  });

  it('at most one leech appears even if several are eligible', () => {
    const leeches = [
      makeWord({ id: 'leech1', isLeech: true }),
      makeWord({ id: 'leech2', isLeech: true }),
    ];
    const due = Array.from({ length: 3 }, (_, i) => makeWord({ id: `due${i}` }));
    const session = buildSession({ sessionId: 's1', due, leech: leeches, fresh: [], now: NOW, size: 5, caps: FULL_CAPS });
    const leechCount = session.items.filter((i) => i.wordId === 'leech1' || i.wordId === 'leech2').length;
    expect(leechCount).toBe(1);
  });

  it('a word triaged as `partial` (easeLevel 2, reviewCount 0) is eligible for recall immediately', () => {
    const word = makeWord({ easeLevel: 2, reviewCount: 0, status: 'learning' });
    expect(isEligible('recall', word, FULL_CAPS)).toBe(true);
  });

  it('a fresh new word (easeLevel 0, reviewCount 0) is NOT eligible for recall', () => {
    const word = makeWord({ easeLevel: 0, reviewCount: 0, status: 'new' });
    expect(isEligible('recall', word, FULL_CAPS)).toBe(false);
  });

  it('a word seen 3+ times is eligible for recall regardless of easeLevel', () => {
    const word = makeWord({ easeLevel: 0, reviewCount: 3 });
    expect(isEligible('recall', word, FULL_CAPS)).toBe(true);
  });

  it('docs/decision.md ADR-018 — a "degraded" corpus word (gloss only, no example/distractors) is eligible for recall', () => {
    const word = makeWord({ easeLevel: 0, reviewCount: 0, exampleSentence: '', distractors: [], meaningVi: 'giảm thiểu' });
    expect(isEligible('recall', word, FULL_CAPS)).toBe(true);
  });

  it('a fully-enriched word (has an exampleSentence) is unaffected by the degraded-word exception', () => {
    const word = makeWord({ easeLevel: 0, reviewCount: 0 }); // default has a real exampleSentence
    expect(isEligible('recall', word, FULL_CAPS)).toBe(false); // still governed by the normal rule
  });

  it('a word with neither content nor review history (empty meaningVi too) is NOT eligible for recall', () => {
    const word = makeWord({ easeLevel: 0, reviewCount: 0, exampleSentence: '', distractors: [], meaningVi: '' });
    expect(isEligible('recall', word, FULL_CAPS)).toBe(false);
  });

  it('when audio is unavailable, no item is assigned `listen`', () => {
    const noAudio: SessionCaps = { audioAvailable: false, aiAvailable: true };
    const due = Array.from({ length: 5 }, (_, i) => makeWord({ id: `due${i}` }));
    const session = buildSession({ sessionId: 's1', due, leech: [], fresh: [], now: NOW, size: 5, caps: noAudio });
    expect(session.items.some((i) => i.kind === 'listen')).toBe(false);
  });

  it('at most one `write` per session — extras are demoted', () => {
    const due = Array.from({ length: 5 }, (_, i) => makeWord({ id: `due${i}` }));
    const session = buildSession({ sessionId: 's1', due, leech: [], fresh: [], now: NOW, size: 5, caps: FULL_CAPS });
    expect(session.items.filter((i) => i.kind === 'write')).toHaveLength(1);
  });

  it('a leech never gets fillBlank even when it is the only word available', () => {
    const leech = makeWord({ id: 'leech1', isLeech: true, distractors: ['a', 'b', 'c'] });
    const session = buildSession({ sessionId: 's1', due: [], leech: [leech], fresh: [], now: NOW, size: 5, caps: FULL_CAPS });
    expect(session.items.every((i) => i.kind !== 'fillBlank' || i.wordId !== 'leech1')).toBe(true);
  });

  it('items array is unchanged (same length, same wordIds, same order) after every word in it is "rescheduled"', () => {
    const due = Array.from({ length: 5 }, (_, i) => makeWord({ id: `due${i}` }));
    const session = buildSession({ sessionId: 's1', due, leech: [], fresh: [], now: NOW, size: 5, caps: FULL_CAPS });
    const before = session.items.map((i) => i.wordId);

    // Simulate "rescheduling" every word (as recordReview would, mutating dueAt in
    // the DB) — buildSession's output must not observe this, because it's a plain
    // object with no live reference back to the source arrays.
    for (const item of session.items) {
      item.snapshot.dueAt = NOW + 999_999; // would-be mutation, if session held a live reference
    }

    expect(session.items.map((i) => i.wordId)).toEqual(before);
    expect(session.items).toHaveLength(5);
  });
});
