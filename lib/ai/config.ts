import 'server-only';
import { z } from 'zod';

const EnvSchema = z.object({
  // Gemini is the primary provider for the AI Riser competition build (Google
  // technology integration is a scored criterion) — the OpenAI-compatible provider
  // stays wired as a fallback (docs/decision.md ADR-003), just no longer the
  // default. See docs/decision.md ADR-012.
  AI_PROVIDER: z.enum(['openai', 'gemini']).default('gemini'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_API_URL: z.string().optional(),
  OPENAI_MODEL_NAME: z.string().optional(),
  // Opt-in, not auto-detected: some OpenAI-compatible reasoning-model deployments
  // (observed: Xiaomi MiMo) accept a `thinking: {type:'disabled'}` request field
  // that skips chain-of-thought generation entirely — 15s vs 117s for the same
  // request in testing (docs/decision.md ADR-021), since a structured-extraction
  // task gains little from reasoning but was paying for it in both latency and
  // completion-token budget. Left off by default because sending an unrecognized
  // field to a DIFFERENT OpenAI-compatible backend (the real OpenAI API, or a
  // stricter gateway) risks a 400 there instead — this must be turned on knowing
  // the configured OPENAI_API_URL supports it.
  OPENAI_DISABLE_THINKING: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  GEMINI_API_KEY: z.string().optional(),
  APP_URL: z.string().optional(),
});

let cached: z.infer<typeof EnvSchema> | null = null;

/** Parsed once, cached — a bogus AI_PROVIDER value fails loudly at first use instead
 * of silently falling through. See docs/api_document.md §7 for the full var list. */
function getEnv() {
  if (!cached) {
    const parsed = EnvSchema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(`Invalid AI environment configuration: ${parsed.error.message}`);
    }
    cached = parsed.data;
  }
  return cached;
}

export interface OpenAiConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  disableThinking: boolean;
}

export interface GeminiConfig {
  apiKey: string;
  textModel: string;
  ttsModel: string;
  ttsVoice: string;
}

export const GEMINI_TEXT_MODEL = 'gemini-3.6-flash';
export const GEMINI_TTS_MODEL = 'gemini-3.1-flash-tts-preview';
export const GEMINI_TTS_VOICE = 'Kore';

export function getActiveProviderId(): 'openai' | 'gemini' {
  return getEnv().AI_PROVIDER;
}

export function getOpenAiConfig(): OpenAiConfig | null {
  const env = getEnv();
  if (!env.OPENAI_API_KEY || !env.OPENAI_API_URL) return null;
  return {
    apiKey: env.OPENAI_API_KEY,
    baseUrl: env.OPENAI_API_URL.replace(/\/+$/, ''),
    model: env.OPENAI_MODEL_NAME ?? 'gpt-4o-mini',
    disableThinking: env.OPENAI_DISABLE_THINKING,
  };
}

export function getGeminiConfig(): GeminiConfig | null {
  const env = getEnv();
  if (!env.GEMINI_API_KEY) return null;
  return {
    apiKey: env.GEMINI_API_KEY,
    textModel: GEMINI_TEXT_MODEL,
    ttsModel: GEMINI_TTS_MODEL,
    ttsVoice: GEMINI_TTS_VOICE,
  };
}

export function getAppUrl(): string {
  return getEnv().APP_URL ?? 'http://localhost:3000';
}
