import { describe, expect, it } from 'vitest';
import { MemoryRateLimiter, rateLimitKey, rateLimitKeyForUser } from '../rate-limit';

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

function headers(map: Record<string, string>) {
  return { headers: { get: (name: string) => map[name] ?? null } };
}

describe('rate limit keys', () => {
  it('derives the IP key from the first x-forwarded-for hop', () => {
    const key = rateLimitKey(headers({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }), 'extractWords');
    expect(key).toBe('203.0.113.9|extractWords');
  });

  it('falls back to x-real-ip, then to a shared unknown bucket', () => {
    expect(rateLimitKey(headers({ 'x-real-ip': '198.51.100.4' }), 'extractWords')).toBe(
      '198.51.100.4|extractWords',
    );
    expect(rateLimitKey(headers({}), 'extractWords')).toBe('unknown|extractWords');
  });

  it('keeps the uid bucket separate from the IP bucket for the same task', () => {
    expect(rateLimitKeyForUser('abc123', 'extractWords')).toBe('uid:abc123|extractWords');
    expect(rateLimitKeyForUser('abc123', 'extractWords')).not.toBe(
      rateLimitKey(headers({ 'x-real-ip': 'abc123' }), 'extractWords'),
    );
  });

  it('separates the same uid across tasks', () => {
    expect(rateLimitKeyForUser('abc123', 'analyzeDocument')).not.toBe(
      rateLimitKeyForUser('abc123', 'analyzeWork'),
    );
  });

  it('blocks when either bucket is exhausted, which is how createAiRoute charges both', async () => {
    const limiter = new MemoryRateLimiter();
    const limit = { perMinute: 1, perDay: 100 };
    const ipKey = rateLimitKey(headers({ 'x-real-ip': '203.0.113.9' }), 'analyzeWork');

    // Same IP, two different accounts: the uid buckets are both fresh, but the
    // shared IP bucket is already spent — so the second account is still blocked.
    expect((await limiter.consume(ipKey, limit)).ok).toBe(true);
    expect((await limiter.consume(rateLimitKeyForUser('userA', 'analyzeWork'), limit)).ok).toBe(true);

    const second = await Promise.all([
      limiter.consume(ipKey, limit),
      limiter.consume(rateLimitKeyForUser('userB', 'analyzeWork'), limit),
    ]);
    expect(second.some((r) => !r.ok)).toBe(true);
  });
});
