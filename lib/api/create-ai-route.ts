import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { isAllowedOrigin, readBodyWithCap } from './guards';
import { getRateLimiter, rateLimitKey, rateLimitKeyForUser } from './rate-limit';
import { getUserSession } from '@/lib/auth/user-session';
import { problemResponse, type ProblemCode } from './problem';
import { getTextProvider } from '@/lib/ai/provider';
import { withRetry } from '@/lib/ai/retry';
import { logAiUsage } from '@/lib/ai/usage';
import { AiError } from '@/lib/ai/errors';
import type { ServerTask } from '@/lib/ai/tasks/registry.server';

const DEFAULT_MAX_BODY_BYTES = 8 * 1024; // 8KB — tasks with larger input set ServerTask.maxBodyBytes (docs/api_document.md §4)

function codeToProblem(code: AiError['code']): ProblemCode {
  return code; // AiErrorCode is a strict subset of ProblemCode's vocabulary
}

/**
 * Every /api/ai/* route reduces to `export const POST = createAiRoute(someTask)`.
 * Order: request id -> origin check -> size cap -> zod validate -> rate limit ->
 * timeout+retry -> repair -> log -> respond. See docs/api_document.md §0 for the
 * exact contract this produces.
 */
export function createAiRoute<I, O>(task: ServerTask<I, O>) {
  return async function POST(req: NextRequest): Promise<Response> {
    const requestId = crypto.randomUUID();

    if (!isAllowedOrigin(req)) {
      return problemResponse('forbidden_origin', requestId);
    }

    const session = await getUserSession();
    if (task.requireSession && !session) {
      return problemResponse('login_required', requestId);
    }

    const maxBytes = task.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
    const bodyResult = await readBodyWithCap(req, maxBytes);
    if (!bodyResult.ok) {
      return problemResponse('payload_too_large', requestId);
    }

    let rawInput: unknown;
    try {
      rawInput = bodyResult.text.length > 0 ? JSON.parse(bodyResult.text) : {};
    } catch {
      return problemResponse('bad_request', requestId);
    }

    const parsedInput = task.input.safeParse(rawInput);
    if (!parsedInput.success) {
      return problemResponse('invalid_input', requestId);
    }
    const input = parsedInput.data;

    // Both keys are charged when signed in: the IP bucket survives a forged or
    // rotated session cookie, the uid bucket survives a rotated IP. Either one
    // running out rejects the call.
    const limiter = getRateLimiter();
    const keys = [rateLimitKey(req, task.id)];
    if (session) keys.push(rateLimitKeyForUser(session.uid, task.id));
    const results = await Promise.all(keys.map((key) => limiter.consume(key, task.rateLimit)));
    const blocked = results.find((r) => !r.ok);
    if (blocked) {
      return problemResponse('rate_limited', requestId, {
        'retry-after': String(Math.ceil(blocked.retryAfterMs / 1000)),
      });
    }

    const provider = getTextProvider();
    if (task.requires?.inlineFiles && !provider.capabilities.inlineFiles) {
      return problemResponse('unsupported_capability', requestId);
    }

    const timeoutSignal = AbortSignal.timeout(task.timeoutMs);
    const signal = AbortSignal.any([req.signal, timeoutSignal]);

    const startedAt = performance.now();
    let attempt = 0;
    try {
      const result = await withRetry(
        async (attemptIndex) => {
          attempt = attemptIndex;
          return provider.generateJson({
            taskId: task.id,
            requestId,
            system: task.system(input),
            parts: task.prompt(input),
            schema: task.output,
            temperature: task.temperature,
            maxOutputTokens: task.maxOutputTokens,
            signal,
          });
        },
        { max: 2, signal },
      );

      const output = task.repair ? task.repair(result.data as O) : (result.data as O);

      logAiUsage({
        requestId, taskId: task.id, providerId: result.providerId, model: result.model,
        attempt, ok: true, latencyMs: Math.round(performance.now() - startedAt),
        usage: result.usage, inputChars: typeof input === 'string' ? input.length : (function() { try { return JSON.stringify(input)?.length ?? 0; } catch { return 0; } })(),
      });

      return NextResponse.json(output, { headers: { 'x-request-id': requestId } });
    } catch (err) {
      const aiErr = err instanceof AiError ? err : new AiError('unknown', { cause: err });
      logAiUsage({
        requestId, taskId: task.id, providerId: provider.id, model: provider.textModel,
        attempt, ok: false, code: aiErr.code, latencyMs: Math.round(performance.now() - startedAt),
        usage: { promptTokens: null, completionTokens: null, totalTokens: null },
        inputChars: typeof input === 'string' ? input.length : (function() { try { return JSON.stringify(input)?.length ?? 0; } catch { return 0; } })(),
      });
      if (aiErr.code === 'quota_exhausted' || aiErr.code === 'rate_limited') {
        const causeMsg =
          aiErr.detail.cause instanceof Error
            ? aiErr.detail.cause.message
            : typeof aiErr.detail.cause === 'string'
            ? aiErr.detail.cause
            : aiErr.message;
        console.warn(`[lexio/ai] ${task.id} ${aiErr.code}:`, causeMsg);
      } else {
        const causeMsg =
          aiErr.detail.cause instanceof Error
            ? aiErr.detail.cause.message
            : typeof aiErr.detail.cause === 'string'
            ? aiErr.detail.cause
            : aiErr.message;
        console.error(`[lexio/ai] ${task.id} failed:`, aiErr.code, causeMsg);
      }
      return problemResponse(codeToProblem(aiErr.code), requestId);
    }
  };
}
