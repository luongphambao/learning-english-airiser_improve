import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { isAllowedOrigin, readBodyWithCap } from './guards';
import { getRateLimiter, rateLimitKey } from './rate-limit';
import { problemResponse, type ProblemCode } from './problem';
import { getTextProvider } from '@/lib/ai/provider';
import { withRetry } from '@/lib/ai/retry';
import { logAiUsage } from '@/lib/ai/usage';
import { AiError } from '@/lib/ai/errors';
import type { ServerTask } from '@/lib/ai/tasks/registry.server';

const DEFAULT_MAX_BODY_BYTES = 8 * 1024; // 8KB — analyze-doc overrides to 2MB (docs/api_document.md §4)
const ANALYZE_DOC_MAX_BODY_BYTES = 2 * 1024 * 1024;

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

    const maxBytes = task.id === 'analyzeDocument' ? ANALYZE_DOC_MAX_BODY_BYTES : DEFAULT_MAX_BODY_BYTES;
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

    const limiter = getRateLimiter();
    const rl = await limiter.consume(rateLimitKey(req, task.id), task.rateLimit);
    if (!rl.ok) {
      return problemResponse('rate_limited', requestId, { 'retry-after': String(Math.ceil(rl.retryAfterMs / 1000)) });
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
            signal,
          });
        },
        { max: 2, signal },
      );

      const output = task.repair ? task.repair(result.data as O) : (result.data as O);

      logAiUsage({
        requestId, taskId: task.id, providerId: result.providerId, model: result.model,
        attempt, ok: true, latencyMs: Math.round(performance.now() - startedAt),
        usage: result.usage, inputChars: JSON.stringify(input).length,
      });

      return NextResponse.json(output, { headers: { 'x-request-id': requestId } });
    } catch (err) {
      const aiErr = err instanceof AiError ? err : new AiError('unknown', { cause: err });
      logAiUsage({
        requestId, taskId: task.id, providerId: provider.id, model: provider.textModel,
        attempt, ok: false, code: aiErr.code, latencyMs: Math.round(performance.now() - startedAt),
        usage: { promptTokens: null, completionTokens: null, totalTokens: null },
        inputChars: JSON.stringify(input).length,
      });
      console.error(`[lexio/ai] ${task.id} failed:`, aiErr.code, aiErr.detail.cause ?? aiErr.message);
      return problemResponse(codeToProblem(aiErr.code), requestId);
    }
  };
}
