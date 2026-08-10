import 'server-only';
import { AiError, toAiError } from './errors';

export interface WithRetryOptions {
  max?: number; // retries, not attempts — default 2 (3 attempts total)
  signal: AbortSignal;
  onRetry?(error: AiError, attempt: number, delayMs: number): void;
}

function backoffMs(attempt: number, retryAfterMs?: number): number {
  if (retryAfterMs) return retryAfterMs;
  const base = Math.min(400 * 2 ** attempt, 4000);
  return Math.round(base * (0.5 + Math.random() * 0.5)); // full jitter
}

/**
 * Retries only AiError.retryable failures, honours Retry-After when the provider
 * gave one, and never sleeps past the caller's own AbortSignal — a client
 * disconnect and a budget expiry are handled by the same signal, so the loop just
 * has to check it before each sleep. See docs/api_document.md §0 for which codes
 * are retryable.
 */
export async function withRetry<T>(fn: (attempt: number) => Promise<T>, opts: WithRetryOptions): Promise<T> {
  const max = opts.max ?? 2;
  let lastError: AiError | null = null;

  for (let attempt = 0; attempt <= max; attempt++) {
    if (opts.signal.aborted) throw new AiError('aborted', {});
    try {
      return await fn(attempt);
    } catch (err) {
      const aiErr = toAiError(err);
      lastError = aiErr;
      if (!aiErr.retryable || attempt === max) throw aiErr;

      const delay = backoffMs(attempt, aiErr.detail.retryAfterMs);
      opts.onRetry?.(aiErr, attempt, delay);
      await sleep(delay, opts.signal);
    }
  }
  throw lastError ?? new AiError('unknown', {});
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new AiError('aborted', {}));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}
