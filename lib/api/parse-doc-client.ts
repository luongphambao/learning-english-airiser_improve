import { ApiError } from './client';

export interface ParsedDocument {
  /** Ordered units — real pages for a PDF, paragraphs for a DOCX — kept apart
   * (not joined) so stores/doc-store.ts can chunk them into per-batch AI calls
   * with real "Trang N" progress (docs/decision.md ADR-021). */
  units: string[];
  unitLabel: 'page' | 'part';
  fileName: string;
}

/**
 * POSTs a PDF/DOCX file to /api/parse-doc as multipart/form-data — the one
 * non-JSON caller in the app (every AI task goes through lib/api/ai-client.ts's
 * callTask instead, docs/decision.md ADR-021). Mirrors postJson's (lib/api/client.ts)
 * {error:{code,message,requestId}} envelope handling so ApiError.messageVi renders
 * the same way everywhere in the UI. No retry: a re-upload is the user re-picking
 * the file, not a transparent retry of a large body.
 */
export async function parseDocumentFile(file: File, opts: { timeoutMs?: number } = {}): Promise<ParsedDocument> {
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const form = new FormData();
  form.append('file', file);

  let res: Response;
  try {
    res = await fetch('/api/parse-doc', { method: 'POST', body: form, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    if (err instanceof DOMException && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
      throw new ApiError('timeout', 0, 'Yêu cầu mất quá nhiều thời gian. Thử lại nhé.', null);
    }
    throw new ApiError('network_error', 0, 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.', null);
  }

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
    throw new ApiError(code, res.status, messageVi, requestId);
  }

  return (await res.json()) as ParsedDocument;
}
