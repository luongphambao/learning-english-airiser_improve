import 'server-only';

export type ProviderId = 'openai' | 'gemini';

export type AiErrorCode =
  | 'bad_request'
  | 'auth'
  | 'rate_limited'
  | 'quota_exhausted'
  | 'timeout'
  | 'aborted'
  | 'upstream_unavailable'
  | 'content_filtered'
  | 'invalid_output'
  | 'unsupported_capability'
  | 'unknown';

export interface AiErrorDetail {
  providerId?: ProviderId;
  taskId?: string;
  requestId?: string;
  status?: number;
  retryAfterMs?: number;
  cause?: unknown;
}

/** Every failure from a provider call funnels through this type — see
 * docs/api_document.md §0. `detail.cause` may hold the raw upstream error for
 * server logs; it must never be serialized into an HTTP response (lib/api/problem.ts
 * maps `code` to a static Vietnamese message instead). */
export class AiError extends Error {
  readonly code: AiErrorCode;
  readonly detail: AiErrorDetail;

  constructor(code: AiErrorCode, detail: AiErrorDetail = {}, message?: string) {
    super(message ?? code);
    this.name = 'AiError';
    this.code = code;
    this.detail = detail;
  }

  get retryable(): boolean {
    return this.code === 'rate_limited' || this.code === 'upstream_unavailable' || this.code === 'invalid_output';
  }
}

export function toAiError(err: unknown, detail: AiErrorDetail = {}): AiError {
  if (err instanceof AiError) return err;
  if (err instanceof Error && err.name === 'AbortError') {
    return new AiError('aborted', { ...detail, cause: err });
  }
  return new AiError('unknown', { ...detail, cause: err }, err instanceof Error ? err.message : String(err));
}
