import { describe, expect, it } from 'vitest';
import { resolveLevel } from '../resolve';
import type { LevelProfile } from '@/lib/domain';

const NOW = Date.UTC(2026, 5, 1);
const DAY = 86_400_000;

const EMPTY_PROFILE: LevelProfile = {
  declared: null,
  placement: null,
  work: null,
  srs: null,
  updatedAt: null,
  lastPromptedAt: null,
};

describe('resolveLevel', () => {
  it('R1 — a manual declaration wins over every automatic signal', () => {
    const profile: LevelProfile = {
      ...EMPTY_PROFILE,
      declared: 'C1',
      placement: { level: 'A2', weight: 3, at: NOW },
    };
    const result = resolveLevel({ profile, current: 'B2', now: NOW });
    expect(result.level).toBe('C1');
    expect(result.changed).toBe(false);
  });

  it('R1 — strong disagreeing evidence surfaces as a dismissible suggestion, never a silent change', () => {
    const profile: LevelProfile = {
      ...EMPTY_PROFILE,
      declared: 'C1',
      placement: { level: 'A2', weight: 3, at: NOW },
    };
    const result = resolveLevel({ profile, current: 'B2', now: NOW });
    expect(result.level).toBe('C1'); // still pinned
    expect(result.suggestion).toBe('A2');
  });

  it('R1 — the suggestion respects its own 14-day cooldown', () => {
    const profile: LevelProfile = {
      ...EMPTY_PROFILE,
      declared: 'C1',
      placement: { level: 'A2', weight: 3, at: NOW },
      lastPromptedAt: NOW - 3 * DAY,
    };
    const result = resolveLevel({ profile, current: 'B2', now: NOW });
    expect(result.suggestion).toBeNull();
  });

  it('R5 — no automatic move within 14 days of the last real move', () => {
    const profile: LevelProfile = {
      ...EMPTY_PROFILE,
      work: { level: 'C1', weight: 3, at: NOW },
      updatedAt: NOW - 5 * DAY,
    };
    const result = resolveLevel({ profile, current: 'B2', now: NOW });
    expect(result.level).toBe('B2');
    expect(result.changed).toBe(false);
  });

  it('R5 — a move is allowed again once the cooldown has elapsed', () => {
    const profile: LevelProfile = {
      ...EMPTY_PROFILE,
      work: { level: 'C1', weight: 3, at: NOW },
      updatedAt: NOW - 15 * DAY,
    };
    const result = resolveLevel({ profile, current: 'B2', now: NOW });
    expect(result.changed).toBe(true);
  });

  it('R4 — one step at a time, even when the evidence points much further', () => {
    const profile: LevelProfile = {
      ...EMPTY_PROFILE,
      work: { level: 'C2', weight: 3, at: NOW },
      updatedAt: NOW - 20 * DAY,
    };
    const result = resolveLevel({ profile, current: 'B1', now: NOW });
    expect(result.level).toBe('B2'); // one step up from B1, not straight to C2
    expect(result.changed).toBe(true);
  });

  it('R2 — the very first resolution (a fresh placement, nothing ever resolved before) seeds directly, skipping the one-step clamp', () => {
    const profile: LevelProfile = {
      ...EMPTY_PROFILE,
      placement: { level: 'C2', weight: 3, at: NOW },
      updatedAt: null,
    };
    const result = resolveLevel({ profile, current: 'B2', now: NOW });
    expect(result.level).toBe('C2'); // straight there, not clamped to C1
    expect(result.changed).toBe(true);
  });

  it('R7 — a down-move is rejected below the stricter weight floor', () => {
    const profile: LevelProfile = {
      ...EMPTY_PROFILE,
      srs: { level: 'A2', weight: 2, at: NOW },
      updatedAt: NOW - 20 * DAY,
    };
    const result = resolveLevel({ profile, current: 'B2', now: NOW });
    expect(result.level).toBe('B2');
    expect(result.changed).toBe(false);
  });

  it('R7 — the same down-move is accepted once weight clears the stricter floor', () => {
    const profile: LevelProfile = {
      ...EMPTY_PROFILE,
      srs: { level: 'A2', weight: 3, at: NOW },
      updatedAt: NOW - 20 * DAY,
    };
    const result = resolveLevel({ profile, current: 'B2', now: NOW });
    expect(result.level).toBe('B1'); // one step down, not straight to A2
    expect(result.changed).toBe(true);
  });

  it('an up-move only needs the lower weight floor', () => {
    const profile: LevelProfile = {
      ...EMPTY_PROFILE,
      work: { level: 'C1', weight: 2, at: NOW },
      updatedAt: NOW - 20 * DAY,
    };
    const result = resolveLevel({ profile, current: 'B2', now: NOW });
    expect(result.changed).toBe(true);
  });

  it('all signals agreeing on the same band moves cleanly to it', () => {
    const profile: LevelProfile = {
      ...EMPTY_PROFILE,
      placement: { level: 'C1', weight: 3, at: NOW },
      work: { level: 'C1', weight: 1.5, at: NOW },
      srs: { level: 'C1', weight: 2, at: NOW },
      updatedAt: NOW - 20 * DAY,
    };
    const result = resolveLevel({ profile, current: 'B2', now: NOW });
    expect(result.level).toBe('C1');
    expect(result.changed).toBe(true);
  });

  it('conflicting signals combine via a weighted MEDIAN, not a mean — the heavier signal dominates', () => {
    // placement (weight 3) says A2; srs (weight 1) says C2. A naive mean would land
    // on B1 (unchanged from `current`); the weighted median instead lands on A2,
    // proving it isn't averaging.
    const profile: LevelProfile = {
      ...EMPTY_PROFILE,
      placement: { level: 'A2', weight: 3, at: NOW },
      srs: { level: 'C2', weight: 1, at: NOW },
      updatedAt: NOW - 20 * DAY,
    };
    const result = resolveLevel({ profile, current: 'B1', now: NOW });
    expect(result.level).toBe('A2');
    expect(result.changed).toBe(true);
  });

  it('no signals at all leaves the level unchanged', () => {
    const result = resolveLevel({ profile: EMPTY_PROFILE, current: 'B2', now: NOW });
    expect(result.level).toBe('B2');
    expect(result.changed).toBe(false);
    expect(result.suggestion).toBeNull();
  });

  it('a stale placement (older than 90 days) counts for less weight', () => {
    const profile: LevelProfile = {
      ...EMPTY_PROFILE,
      placement: { level: 'A2', weight: 3, at: NOW - 200 * DAY }, // weight recomputed fresh each call
      updatedAt: NOW - 20 * DAY,
    };
    // A stale placement alone (recomputed weight 1) is below the down-move floor (3)
    // even though the STORED weight said 3 — resolveLevel recomputes freshness itself.
    const result = resolveLevel({ profile, current: 'B2', now: NOW });
    expect(result.changed).toBe(false);
  });

  it('R8 is not this function\'s concern — resolveLevel is stateless per call and never reads any session state', () => {
    // Documented as a structural guarantee: resolveLevel takes no session/exercise
    // input at all, so "never mid-session" is enforced by WHEN callers invoke it
    // (docs/decision.md ADR-004), not by anything in this function.
    expect(resolveLevel.length).toBe(1); // single ({profile, current, now}) argument
  });
});
