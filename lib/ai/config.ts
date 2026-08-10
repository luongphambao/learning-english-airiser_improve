import 'server-only';
import { z } from 'zod';

const EnvSchema = z.object({
  AI_PROVIDER: z.enum(['openai', 'gemini']).default('openai'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_API_URL: z.string().optional(),
  OPENAI_MODEL_NAME: z.string().optional(),
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
