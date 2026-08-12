import { NextRequest } from 'next/server';
import { z } from 'zod';
import { isAllowedOrigin, readBodyWithCap } from '@/lib/api/guards';
import { getRateLimiter, rateLimitKey } from '@/lib/api/rate-limit';
import { problemResponse } from '@/lib/api/problem';
import { getTtsProvider } from '@/lib/ai/provider';
import { withRetry } from '@/lib/ai/retry';
import { AiError } from '@/lib/ai/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 20;

const TtsInput = z.object({ text: z.string().trim().min(1).max(240) });
const RATE_LIMIT = { perMinute: 30, perDay: 500 };
const MAX_BODY_BYTES = 4 * 1024;

// tts doesn't return JSON, so it doesn't go through createAiRoute — same guards
// (origin/size/rate-limit), different response shape. See docs/api_document.md §6.
export async function POST(req: NextRequest): Promise<Response> {
  const requestId = crypto.randomUUID();

  if (!isAllowedOrigin(req)) return problemResponse('forbidden_origin', requestId);

  const bodyResult = await readBodyWithCap(req, MAX_BODY_BYTES);
  if (!bodyResult.ok) return problemResponse('payload_too_large', requestId);

  let rawInput: unknown;
  try {
    rawInput = JSON.parse(bodyResult.text);
  } catch {
    return problemResponse('bad_request', requestId);
  }
  const parsed = TtsInput.safeParse(rawInput);
  if (!parsed.success) return problemResponse('invalid_input', requestId);

  const limiter = getRateLimiter();
  const rl = await limiter.consume(rateLimitKey(req, 'tts'), RATE_LIMIT);
  if (!rl.ok) {
    return problemResponse('rate_limited', requestId, { 'retry-after': String(Math.ceil(rl.retryAfterMs / 1000)) });
  }

  // No TTS provider configured -> instant 501, no upstream call, no cost.
  // The client (components/exercises/audio-button.tsx once Phase 7 lands, and
  // ExerciseListen.tsx today) treats this as a normal "no audio" state, not an
  // error to surface — see docs/decision.md ADR-003.
  const provider = getTtsProvider();
  if (!provider?.generateSpeech) return problemResponse('unsupported_capability', requestId);

  const signal = AbortSignal.any([req.signal, AbortSignal.timeout(15_000)]);
  try {
    const result = await withRetry(
      () => provider.generateSpeech!({ taskId: 'tts', requestId, text: parsed.data.text, signal }),
      { max: 1, signal },
    );
    return new Response(Buffer.from(result.data.bytes), {
      headers: {
        'content-type': result.data.mimeType,
        'cache-control': 'private, max-age=31536000, immutable',
        'x-request-id': requestId,
      },
    });
  } catch (err) {
    const aiErr = err instanceof AiError ? err : new AiError('unknown', { cause: err });
    const causeMsg =
      aiErr.detail.cause instanceof Error
        ? aiErr.detail.cause.message
        : typeof aiErr.detail.cause === 'string'
        ? aiErr.detail.cause
        : aiErr.message;
    console.warn(`[lexio/ai] tts unavailable (${aiErr.code}):`, causeMsg);
    return problemResponse('unsupported_capability', requestId);
  }
}
