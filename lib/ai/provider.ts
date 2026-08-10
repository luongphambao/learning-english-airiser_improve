import 'server-only';
import { getActiveProviderId, getGeminiConfig, getOpenAiConfig } from './config';
import { createOpenAiProvider } from './providers/openai';
import { createGeminiProvider } from './providers/gemini';
import type { AiProvider } from './types';

// Hoisted singletons — the old routes constructed a new GoogleGenAI client on
// every single request (audit: 5 routes, `new GoogleGenAI(...)` inside the handler
// body each time). One client per process instead.
const KEY = Symbol.for('lexio.ai.providers');
const globalCache = globalThis as unknown as Record<symbol, { text?: AiProvider; tts?: AiProvider | null } | undefined>;

function cache() {
  return (globalCache[KEY] ??= {});
}

function buildTextProvider(): AiProvider {
  const providerId = getActiveProviderId();
  if (providerId === 'gemini') {
    const cfg = getGeminiConfig();
    if (!cfg) throw new Error('AI_PROVIDER=gemini but GEMINI_API_KEY is not configured');
    return createGeminiProvider(cfg);
  }
  const cfg = getOpenAiConfig();
  if (!cfg) throw new Error('AI_PROVIDER=openai but OPENAI_API_KEY/OPENAI_API_URL is not configured');
  return createOpenAiProvider(cfg);
}

export function getTextProvider(): AiProvider {
  const c = cache();
  if (!c.text) c.text = buildTextProvider();
  return c.text;
}

/** Returns null when no provider with TTS capability is configured — the tts route
 * turns that into an instant 501 rather than an upstream call. */
export function getTtsProvider(): AiProvider | null {
  const c = cache();
  if (c.tts !== undefined) return c.tts;
  const geminiCfg = getGeminiConfig();
  c.tts = geminiCfg ? createGeminiProvider(geminiCfg) : null;
  return c.tts;
}
