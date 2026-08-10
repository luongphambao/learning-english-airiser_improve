import { describe, expect, it } from 'vitest';
import { MemoryRateLimiter } from '../rate-limit';

describe('MemoryRateLimiter', () => {
  it('allows requests up to the per-minute limit, then blocks with a retry-after', async () => {
    const limiter = new MemoryRateLimiter();
    const limit = { perMinute: 3, perDay: 100 };

    for (let i = 0; i < 3; i++) {
      const r = await limiter.consume('user1', limit);
      expect(r.ok).toBe(true);
    }
    const blocked = await limiter.consume('user1', limit);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it('tracks separate keys independently', async () => {
    const limiter = new MemoryRateLimiter();
    const limit = { perMinute: 1, perDay: 100 };

    expect((await limiter.consume('user1', limit)).ok).toBe(true);
    expect((await limiter.consume('user1', limit)).ok).toBe(false);
    expect((await limiter.consume('user2', limit)).ok).toBe(true); // unaffected by user1
  });

  it('the day limit blocks even when the minute window would otherwise allow it', async () => {
    const limiter = new MemoryRateLimiter();
    const limit = { perMinute: 100, perDay: 2 };

    expect((await limiter.consume('user1', limit)).ok).toBe(true);
    expect((await limiter.consume('user1', limit)).ok).toBe(true);
    const blocked = await limiter.consume('user1', limit);
    expect(blocked.ok).toBe(false);
  });
});
