import 'server-only';

export interface RateLimitResult {
  ok: boolean;
  retryAfterMs: number;
}

export interface RateLimiter {
  consume(key: string, limit: { perMinute: number; perDay: number }): Promise<RateLimitResult>;
}

interface Bucket {
  minuteCount: number;
  minuteResetAt: number;
  dayCount: number;
  dayResetAt: number;
}

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

/**
 * In-memory token-bucket-ish counter, stored on `globalThis` so dev HMR doesn't
 * reset it. On Cloud Run with N instances the effective limit is N× — acceptable
 * as a cost guard-rail, not a security boundary. `RATE_LIMIT_REDIS_URL` (unset in
 * this pass) is the seam for a durable limiter later — see docs/api_document.md §0.
 */
export class MemoryRateLimiter implements RateLimiter {
  private buckets = new Map<string, Bucket>();

  async consume(key: string, limit: { perMinute: number; perDay: number }): Promise<RateLimitResult> {
    const now = Date.now();
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.dayResetAt <= now) {
      bucket = { minuteCount: 0, minuteResetAt: now + MINUTE_MS, dayCount: 0, dayResetAt: now + DAY_MS };
    }
    if (bucket.minuteResetAt <= now) {
      bucket.minuteCount = 0;
      bucket.minuteResetAt = now + MINUTE_MS;
    }

    if (bucket.minuteCount >= limit.perMinute) {
      this.buckets.set(key, bucket);
      return { ok: false, retryAfterMs: bucket.minuteResetAt - now };
    }
    if (bucket.dayCount >= limit.perDay) {
      this.buckets.set(key, bucket);
      return { ok: false, retryAfterMs: bucket.dayResetAt - now };
    }

    bucket.minuteCount += 1;
    bucket.dayCount += 1;
    this.buckets.set(key, bucket);
    return { ok: true, retryAfterMs: 0 };
  }
}

const KEY = Symbol.for('lexio.api.rateLimiter');
const globalCache = globalThis as unknown as Record<symbol, RateLimiter | undefined>;

export function getRateLimiter(): RateLimiter {
  return (globalCache[KEY] ??= new MemoryRateLimiter());
}

export function rateLimitKey(req: { headers: { get(name: string): string | null } }, taskId: string): string {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? 'unknown';
  return `${ip}|${taskId}`;
}

/** Signed-in callers are additionally counted per account, so one user cannot
 * multiply their quota by rotating IPs. The IP key stays in force alongside it —
 * the session cookie is not signed, so a uid on its own is caller-chosen. */
export function rateLimitKeyForUser(uid: string, taskId: string): string {
  return `uid:${uid}|${taskId}`;
}
