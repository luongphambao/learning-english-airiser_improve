import { beforeEach, describe, expect, it } from 'vitest';
import { resetDbForTests } from '@/lib/db/dexie';
import { createDexieWordRepository } from '@/lib/repositories/dexie/word-repository';
import { createDexieSkippedRepository } from '@/lib/repositories/dexie/skipped-repository';
import { buildExclusionSet } from '../exclude';

describe('buildExclusionSet', () => {
  beforeEach(() => {
    resetDbForTests();
  });

  it('includes every word already in the notebook', async () => {
    const words = createDexieWordRepository();
    const now = Date.UTC(2026, 0, 1);
    await words.add({ word: 'mitigate', source: { kind: 'manual', label: '', at: now } });

    const exclude = await buildExclusionSet();
    expect(exclude.has('mitigate')).toBe(true);
  });

  it('includes soft-deleted words — a deleted word must not be re-suggested', async () => {
    const words = createDexieWordRepository();
    const now = Date.UTC(2026, 0, 1);
    const w = await words.add({ word: 'bottleneck', source: { kind: 'manual', label: '', at: now } });
    await words.remove(w.id);

    const exclude = await buildExclusionSet();
    expect(exclude.has('bottleneck')).toBe(true);
  });

  it('includes every word in the skipped list', async () => {
    const skipped = createDexieSkippedRepository();
    await skipped.add('Leverage', Date.UTC(2026, 0, 1));

    const exclude = await buildExclusionSet();
    expect(exclude.has('leverage')).toBe(true);
  });

  it('stops excluding a word once it has been un-skipped', async () => {
    const skipped = createDexieSkippedRepository();
    const now = Date.UTC(2026, 0, 1);
    await skipped.add('leverage', now);
    await skipped.remove('leverage', now + 1);

    const exclude = await buildExclusionSet();
    expect(exclude.has('leverage')).toBe(false);
  });

  it('is empty when the notebook and skipped list are both empty', async () => {
    const exclude = await buildExclusionSet();
    expect(exclude.size).toBe(0);
  });
});
