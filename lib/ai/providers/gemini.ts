import 'server-only';
import { GoogleGenAI, Modality } from '@google/genai';
import { AiError } from '../errors';
import { parseStructured } from '../parse';
import { parsePcmMimeType, pcmToWav } from '@/lib/audio/pcm-to-wav';
import type { GeminiConfig } from '../config';
import type { AiProvider, GenerateJsonRequest, AiResult, SpeechRequest, SpeechResult } from '../types';

function handleGeminiError(cause: unknown, taskId: string, requestId: string): never {
  if (cause instanceof Error && cause.name === 'AbortError') {
    throw new AiError('aborted', { providerId: 'gemini', taskId, requestId, cause });
  }

  const msg = cause instanceof Error ? cause.message : String(cause ?? '');
  const rawObj = typeof cause === 'object' && cause !== null ? (cause as Record<string, unknown>) : {};
  const status = rawObj.status ?? rawObj.code;

  const isQuotaOrCredits =
    status === 429 ||
    status === 'RESOURCE_EXHAUSTED' ||
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('prepayment credits') ||
    msg.includes('depleted') ||
    msg.includes('Quota exceeded') ||
    msg.includes('rate-limits');

  if (isQuotaOrCredits) {
    if (msg.includes('prepayment credits') || msg.includes('depleted') || msg.includes('Quota exceeded') || msg.includes('quota')) {
      throw new AiError('quota_exhausted', { providerId: 'gemini', taskId, requestId, status: 429, cause });
    }
    throw new AiError('rate_limited', { providerId: 'gemini', taskId, requestId, status: 429, cause });
  }

  if (status === 401 || status === 403 || msg.includes('API key') || msg.includes('UNAUTHENTICATED')) {
    throw new AiError('auth', { providerId: 'gemini', taskId, requestId, cause });
  }

  throw new AiError('upstream_unavailable', { providerId: 'gemini', taskId, requestId, cause });
}

export function createGeminiProvider(cfg: GeminiConfig): AiProvider {
  const client = new GoogleGenAI({ apiKey: cfg.apiKey, httpOptions: { headers: { 'User-Agent': 'lexio' } } });

  return {
    id: 'gemini',
    textModel: cfg.textModel,
    capabilities: { json: true, inlineFiles: true, tts: true },

    async generateJson<T>(req: GenerateJsonRequest<T>): Promise<AiResult<T>> {
      const started = performance.now();
      const userText = req.parts
        .filter((p): p is { kind: 'text'; text: string } => p.kind === 'text')
        .map((p) => p.text)
        .join('\n');

      let response;
      try {
        response = await client.models.generateContent({
          model: cfg.textModel,
          contents: [{ role: 'user', parts: [{ text: userText }] }],
          config: {
            abortSignal: req.signal,
            systemInstruction: req.system,
            temperature: req.temperature ?? 0.4,
            maxOutputTokens: req.maxOutputTokens ?? 2048,
            responseMimeType: 'application/json',
            responseSchema: req.schema.gemini as unknown as Record<string, unknown>,
          },
        });
      } catch (cause) {
        handleGeminiError(cause, req.taskId, req.requestId);
      }

      const candidate = response.candidates?.[0];
      if (candidate?.finishReason === 'SAFETY' || candidate?.finishReason === 'PROHIBITED_CONTENT') {
        throw new AiError('content_filtered', { providerId: 'gemini', taskId: req.taskId, requestId: req.requestId });
      }

      const text = response.text;
      if (!text) {
        throw new AiError('invalid_output', { providerId: 'gemini', taskId: req.taskId, requestId: req.requestId });
      }

      const data = parseStructured(req.schema, text, 'gemini', req.taskId, req.requestId);
      const usageMeta = response.usageMetadata;

      return {
        data,
        usage: {
          promptTokens: usageMeta?.promptTokenCount ?? null,
          completionTokens: usageMeta?.candidatesTokenCount ?? null,
          totalTokens: usageMeta?.totalTokenCount ?? null,
        },
        providerId: 'gemini',
        model: cfg.textModel,
        latencyMs: Math.round(performance.now() - started),
        finishReason: candidate?.finishReason ?? null,
      };
    },

    async generateSpeech(req: SpeechRequest): Promise<AiResult<SpeechResult>> {
      const started = performance.now();
      let response;
      try {
        response = await client.models.generateContent({
          model: cfg.ttsModel,
          contents: [{ parts: [{ text: `Say clearly: ${req.text}` }] }],
          config: {
            abortSignal: req.signal,
            responseModalities: [Modality.AUDIO],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: cfg.ttsVoice } } },
          },
        });
      } catch (cause) {
        handleGeminiError(cause, req.taskId, req.requestId);
      }

      const part = response.candidates?.[0]?.content?.parts?.[0];
      const base64 = part?.inlineData?.data;
      if (!base64) {
        throw new AiError('invalid_output', { providerId: 'gemini', taskId: req.taskId, requestId: req.requestId });
      }

      // The bug fix: read the REAL mimeType instead of assuming/discarding it, and
      // wrap the raw PCM in an actual RIFF/WAVE header before it ever leaves the
      // server — see lib/audio/pcm-to-wav.ts.
      const mimeType = part.inlineData?.mimeType ?? 'audio/L16;rate=24000';
      const format = parsePcmMimeType(mimeType);
      const pcmBytes = Uint8Array.from(Buffer.from(base64, 'base64'));
      const wavBytes = pcmToWav(pcmBytes, format);

      return {
        data: { bytes: wavBytes, mimeType: 'audio/wav' },
        usage: { promptTokens: null, completionTokens: null, totalTokens: null },
        providerId: 'gemini',
        model: cfg.ttsModel,
        latencyMs: Math.round(performance.now() - started),
        finishReason: response.candidates?.[0]?.finishReason ?? null,
      };
    },
  };
}
