import { NextRequest, NextResponse } from 'next/server';
import { isAllowedOrigin } from '@/lib/api/guards';
import { getRateLimiter, rateLimitKey } from '@/lib/api/rate-limit';
import { problemResponse } from '@/lib/api/problem';
import { docKindForFileName, extractDocumentText, DocumentParseError } from '@/lib/documents/extract.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Not an AI call (no Gemini/OpenAI spend to protect), but still real CPU per
// request (pdfjs page-by-page parsing) — a generous, not a tight, limit.
const RATE_LIMIT = { perMinute: 10, perDay: 100 };
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/**
 * Turns a PDF/DOCX upload into plain text for analyzeDocument (docs/decision.md
 * ADR-021). Deliberately NOT built on createAiRoute (lib/api/create-ai-route.ts) —
 * that helper is JSON-body + zod + AI-provider shaped; this route takes
 * multipart/form-data and never calls a model. Guard order mirrors it anyway:
 * request id -> origin check -> size cap -> rate limit -> parse -> respond.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const requestId = crypto.randomUUID();

  if (!isAllowedOrigin(req)) {
    return problemResponse('forbidden_origin', requestId);
  }

  const contentLength = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > MAX_UPLOAD_BYTES) {
    return problemResponse('payload_too_large', requestId);
  }

  const limiter = getRateLimiter();
  const rl = await limiter.consume(rateLimitKey(req, 'parseDoc'), RATE_LIMIT);
  if (!rl.ok) {
    return problemResponse('rate_limited', requestId, { 'retry-after': String(Math.ceil(rl.retryAfterMs / 1000)) });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return problemResponse('bad_request', requestId);
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return problemResponse('bad_request', requestId);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return problemResponse('payload_too_large', requestId);
  }

  const kind = docKindForFileName(file.name);
  if (!kind) {
    return problemResponse('unsupported_file_type', requestId);
  }

  try {
    const buffer = await file.arrayBuffer();
    const { units, unitLabel } = await extractDocumentText(kind, buffer);
    return NextResponse.json({ units, unitLabel, fileName: file.name }, { headers: { 'x-request-id': requestId } });
  } catch (err) {
    if (err instanceof DocumentParseError) {
      // The client only ever sees err.code, so without this the cause is lost — the
      // reason a container-only "DOMMatrix is not defined" regression took a rebuild
      // to pin down. Safe to log: these messages are library/parser diagnostics and
      // the code's own discriminator, never uploaded document text.
      console.error(`[lexio/parse-doc] rejected (${err.code}):`, err.message);
      return problemResponse(err.code, requestId);
    }
    console.error('[lexio/parse-doc] failed:', err instanceof Error ? err.message : err);
    return problemResponse('unknown', requestId);
  }
}
