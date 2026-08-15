import { beforeEach, describe, expect, it } from 'vitest';
import { resetDbForTests } from '@/lib/db/dexie';
import { createDexieSkippedRepository } from '../dexie/skipped-repository';

// docs/decision.md ADR-017 — the `skipped` table (lib/db/dexie.ts v1) existed since
// the original schema but had no repository; applyTriage('known', ...) has always
// said "caller writes to the skipped list instead" with no caller ever written.
describe('SkippedRepository', () => {
  beforeEach(() => {
    resetDbForTests();
  });

  it('records a word case-insensitively and reports it as skipped', async () => {
    const skipped = createDexieSkippedRepository();
    const now = Date.UTC(2026, 0, 1);

    await skipped.add('Deadline', now);

    expect(await skipped.has('deadline')).toBe(true);
    expect(await skipped.has('DEADLINE')).toBe(true);
    expect(await skipped.has('other')).toBe(false);
  });

  it('lists lowercase keys for the corpus exclusion set', async () => {
    const skipped = createDexieSkippedRepository();
    const now = Date.UTC(2026, 0, 1);

    await skipped.add('Mitigate', now);
    await skipped.add('bottleneck', now + 1);

    expect((await skipped.listLowercase()).sort()).toEqual(['bottleneck', 'mitigate']);
  });

  it('removes a word so it can be suggested again', async () => {
    const skipped = createDexieSkippedRepository();
    const now = Date.UTC(2026, 0, 1);

    await skipped.add('trade-off', now);
    await skipped.remove('Trade-Off');

    expect(await skipped.has('trade-off')).toBe(false);
  });
});
