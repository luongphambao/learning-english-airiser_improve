import 'server-only';
import { AiError } from '../errors';
import { parseStructured } from '../parse';
import type { OpenAiConfig } from '../config';
import type { StructuredSchema } from '../schema';
import type { AiProvider, GenerateJsonRequest, AiResult } from '../types';

function toRetryAfterMs(res: Response): number | undefined {
  const header = res.headers.get('retry-after');
  if (!header) return undefined;
  const seconds = Number(header);
  return Number.isFinite(seconds) ? seconds * 1000 : undefined;
}

async function toHttpError(res: Response, providerId: 'openai', taskId: string, requestId: string): Promise<AiError> {
  const status = res.status;
  const body = await res.text().catch(() => '');
  if (status === 401 || status === 403) return new AiError('auth', { providerId, taskId, requestId, status, cause: body });
  if (status === 429) {
    return new AiError('rate_limited', { providerId, taskId, requestId, status, retryAfterMs: toRetryAfterMs(res), cause: body });
  }
  if (status >= 500) return new AiError('upstream_unavailable', { providerId, taskId, requestId, status, cause: body });
  return new AiError('bad_request', { providerId, taskId, requestId, status, cause: body });
}

/** Not every OpenAI-compatible router actually honors `response_format:
 * json_schema` — some (observed: an FPT Cloud / DeepSeek-V4-Flash deployment)
 * silently return an empty `message.content` whenever `response_format` is
 * present at all, json_schema or plain json_object alike, instead of erroring.
 * So the schema is enforced by prompt instruction instead, with `parseStructured`
 * + the task's own zod schema (see lib/ai/parse.ts) as the real gate — this is
 * strictly a hint to the model, never trusted on its own. */
function buildSchemaInstruction(schema: Pick<StructuredSchema<unknown>, 'name' | 'json'>): string {
  return (
    `Respond with ONLY a single JSON object, no markdown code fences, no prose before or after. ` +
    `It must validate against this JSON Schema (name: ${schema.name}):\n${JSON.stringify(schema.json)}`
  );
}

/** Default provider — hits an OpenAI-compatible chat/completions endpoint (the
 * router configured via OPENAI_API_URL/OPENAI_MODEL_NAME). No TTS capability: an
 * OpenAI-compatible router isn't guaranteed to expose one, so `generateSpeech` is
 * simply absent from the returned object rather than throwing at call time — see
 * docs/decision.md ADR-003 and the capability check in lib/api/create-ai-route.ts. */
export function createOpenAiProvider(cfg: OpenAiConfig): AiProvider {
  return {
    id: 'openai',
    textModel: cfg.model,
    capabilities: { json: true, inlineFiles: false, tts: false },

    async generateJson<T>(req: GenerateJsonRequest<T>): Promise<AiResult<T>> {
      const started = performance.now();
      const userText = req.parts
        .filter((p): p is { kind: 'text'; text: string } => p.kind === 'text')
        .map((p) => p.text)
        .join('\n');

      let res: Response;
      try {
        res = await fetch(`${cfg.baseUrl}/chat/completions`, {
          method: 'POST',
          signal: req.signal,
          headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.apiKey}` },
          body: JSON.stringify({
            model: cfg.model,
            temperature: req.temperature ?? 0.4,
            max_tokens: req.maxOutputTokens ?? 2048,
            messages: [
              { role: 'system', content: `${req.system}\n\n${buildSchemaInstruction(req.schema)}` },
              { role: 'user', content: userText },
            ],
          }),
        });
      } catch (cause) {
        if (cause instanceof Error && cause.name === 'AbortError') {
          throw new AiError('aborted', { providerId: 'openai', taskId: req.taskId, requestId: req.requestId });
        }
        throw new AiError('upstream_unavailable', { providerId: 'openai', taskId: req.taskId, requestId: req.requestId, cause });
      }

      if (!res.ok) throw await toHttpError(res, 'openai', req.taskId, req.requestId);

      const body = await res.json();
      const choice = body.choices?.[0];
      if (choice?.finish_reason === 'content_filter') {
        throw new AiError('content_filtered', { providerId: 'openai', taskId: req.taskId, requestId: req.requestId });
      }
      const text = choice?.message?.content;
      if (typeof text !== 'string' || text.length === 0) {
        throw new AiError('invalid_output', { providerId: 'openai', taskId: req.taskId, requestId: req.requestId });
      }

      const data = parseStructured(req.schema, text, 'openai', req.taskId, req.requestId);

      return {
        data,
        usage: {
          promptTokens: body.usage?.prompt_tokens ?? null,
          completionTokens: body.usage?.completion_tokens ?? null,
          totalTokens: body.usage?.total_tokens ?? null,
        },
        providerId: 'openai',
        model: cfg.model,
        latencyMs: Math.round(performance.now() - started),
        finishReason: choice?.finish_reason ?? null,
      };
    },
  };
}
