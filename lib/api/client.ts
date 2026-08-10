export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly messageVi: string;
  readonly requestId: string | null;

  constructor(code: string, status: number, messageVi: string, requestId: string | null) {
    super(`${code} (${status})`);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.messageVi = messageVi;
    this.requestId = requestId;
  }

  get retryable(): boolean {
    return this.status === 429 || this.status >= 500 || this.status === 0;
  }

  static isAbort(e: unknown): boolean {
    return e instanceof DOMException && e.name === 'AbortError';
  }
}

export interface CallOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  retries?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** The only place in the browser that calls `fetch()` for /api/ai/* — everything
 * else goes through lib/api/ai-client.ts. Handles timeout+external-signal
 * composition, the {error:{code,message,requestId}} envelope, and backoff retry on
 * retryable failures. See docs/api_document.md §0. */
export async function postJson<T>(url: string, body: unknown, opts: CallOptions = {}): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const maxRetries = opts.retries ?? 2;

  for (let attempt = 0; ; attempt++) {
    const signals = [AbortSignal.timeout(timeoutMs)];
    if (opts.signal) signals.push(opts.signal);
    const signal = AbortSignal.any(signals);

    try {
      const res = await fetch(url, {
        method: 'POST',
        signal,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const requestId = res.headers.get('x-request-id');
        let code = 'unknown';
        let messageVi = 'Đã có lỗi xảy ra. Thử lại sau.';
        try {
          const parsed = await res.json();
          code = parsed?.error?.code ?? code;
          messageVi = parsed?.error?.message ?? messageVi;
        } catch {
          // non-JSON error body — keep the defaults
        }
        const err = new ApiError(code, res.status, messageVi, requestId);
        if (err.retryable && attempt < maxRetries) {
          const retryAfter = res.headers.get('retry-after');
          await sleep(retryAfter ? Number(retryAfter) * 1000 : 300 * 2 ** attempt);
          continue;
        }
        throw err;
      }

      return (await res.json()) as T;
    } catch (err) {
      if (ApiError.isAbort(err)) throw new ApiError('aborted', 0, 'Yêu cầu đã bị huỷ.', null);
      if (err instanceof ApiError) throw err;
      if (attempt < maxRetries) {
        await sleep(300 * 2 ** attempt);
        continue;
      }
      throw new ApiError('network_error', 0, 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.', null);
    }
  }
}
