import 'server-only';
import { GoogleGenAI, Modality } from '@google/genai';
import { AiError } from '../errors';
import { parseStructured } from '../parse';
import { parsePcmMimeType, pcmToWav } from '@/lib/audio/pcm-to-wav';
import type { GeminiConfig } from '../config';
import type { AiProvider, GenerateJsonRequest, AiResult, SpeechRequest, SpeechResult } from '../types';

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
        if (cause instanceof Error && cause.name === 'AbortError') {
          throw new AiError('aborted', { providerId: 'gemini', taskId: req.taskId, requestId: req.requestId });
        }
        throw new AiError('upstream_unavailable', { providerId: 'gemini', taskId: req.taskId, requestId: req.requestId, cause });
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
        if (cause instanceof Error && cause.name === 'AbortError') {
          throw new AiError('aborted', { providerId: 'gemini', taskId: req.taskId, requestId: req.requestId });
        }
        throw new AiError('upstream_unavailable', { providerId: 'gemini', taskId: req.taskId, requestId: req.requestId, cause });
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
