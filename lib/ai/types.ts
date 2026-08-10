import 'server-only';
import type { StructuredSchema } from './schema';
import type { ProviderId } from './errors';

export type PromptPart = { kind: 'text'; text: string };

export interface GenerateJsonRequest<T> {
  taskId: string;
  requestId: string;
  system: string;
  parts: PromptPart[];
  schema: StructuredSchema<T>;
  temperature?: number;
  maxOutputTokens?: number;
  signal: AbortSignal;
}

export interface TokenUsage {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
}

export interface AiResult<T> {
  data: T;
  usage: TokenUsage;
  providerId: ProviderId;
  model: string;
  latencyMs: number;
  finishReason: string | null;
}

export interface SpeechRequest {
  taskId: string;
  requestId: string;
  text: string;
  signal: AbortSignal;
}

export interface SpeechResult {
  bytes: Uint8Array; // always a playable container, never raw PCM — lib/audio/pcm-to-wav.ts
  mimeType: 'audio/wav';
}

export interface AiProviderCapabilities {
  json: true;
  inlineFiles: boolean;
  tts: boolean;
}

export interface AiProvider {
  readonly id: ProviderId;
  readonly textModel: string;
  readonly capabilities: AiProviderCapabilities;
  generateJson<T>(req: GenerateJsonRequest<T>): Promise<AiResult<T>>;
  generateSpeech?(req: SpeechRequest): Promise<AiResult<SpeechResult>>;
}
