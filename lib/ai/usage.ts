import 'server-only';
import type { ProviderId } from './errors';
import type { TokenUsage } from './types';

// Per-million-token pricing, USD. Unknown model -> estUsd: null but tokens still
// logged — this table is the ONLY place a cost estimate is computed (docs/api_document.md §8).
const PRICING: Record<string, { inPerMTok: number; outPerMTok: number }> = {
  'gemini-3.6-flash': { inPerMTok: 0.1, outPerMTok: 0.4 },
  'gemini-3.1-flash-tts-preview': { inPerMTok: 0.1, outPerMTok: 0.4 },
};

function estimateUsd(model: string, usage: TokenUsage): number | null {
  const price = PRICING[model];
  if (!price || usage.promptTokens == null || usage.completionTokens == null) return null;
  return (usage.promptTokens / 1e6) * price.inPerMTok + (usage.completionTokens / 1e6) * price.outPerMTok;
}

export interface AiUsageLogEntry {
  requestId: string;
  taskId: string;
  providerId: ProviderId;
  model: string;
  attempt: number;
  ok: boolean;
  code?: string;
  latencyMs: number;
  usage: TokenUsage;
  inputChars: number;
}

export function logAiUsage(entry: AiUsageLogEntry): void {
  const line = {
    ts: new Date().toISOString(),
    requestId: entry.requestId,
    taskId: entry.taskId,
    providerId: entry.providerId,
    model: entry.model,
    attempt: entry.attempt,
    ok: entry.ok,
    code: entry.code ?? null,
    promptTokens: entry.usage.promptTokens,
    completionTokens: entry.usage.completionTokens,
    latencyMs: entry.latencyMs,
    estUsd: estimateUsd(entry.model, entry.usage),
    inputChars: entry.inputChars,
  };
  // One JSON line per attempt to stdout — Cloud Run parses this into structured logs.
  console.log(JSON.stringify(line));
}
