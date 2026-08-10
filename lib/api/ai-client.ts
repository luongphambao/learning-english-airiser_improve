import { postJson, type CallOptions } from './client';
import { TASK_ROUTES, TASK_IO, type TaskId, type TaskInput, type TaskOutput } from '@/lib/ai/tasks/contracts';

/** Typed facade over the /api/ai/* JSON tasks — validates the request locally
 * before sending (fail fast) and validates the response before trusting it (never
 * trust your own route blindly). This is the ONLY place components/stores call an
 * AI task from — see docs/architecture.md §1. */
export async function callTask<K extends TaskId>(
  id: K,
  input: TaskInput<K>,
  opts?: CallOptions,
): Promise<TaskOutput<K>> {
  const parsedInput = TASK_IO[id].input.parse(input);
  const raw = await postJson<unknown>(TASK_ROUTES[id], parsedInput, opts);
  // TS can't narrow TASK_IO[id]'s output schema through a generic K here — the
  // runtime dispatch is correct (id selects the right schema), this cast just
  // restates what zod already validated a line above.
  return TASK_IO[id].output.parse(raw) as TaskOutput<K>;
}

/** Returns null on `tts_unavailable`/`unsupported_capability` — "no audio" is a
 * normal state the caller should silently fall back from, not an error to show. */
export async function fetchSpeech(text: string, opts?: CallOptions): Promise<Blob | null> {
  const timeoutMs = opts?.timeoutMs ?? 15_000;
  const signals = [AbortSignal.timeout(timeoutMs)];
  if (opts?.signal) signals.push(opts.signal);
  const signal = AbortSignal.any(signals);

  const res = await fetch('/api/ai/tts', {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) return null;
  return res.blob();
}
