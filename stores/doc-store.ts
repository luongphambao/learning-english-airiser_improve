import { create } from 'zustand';
import { getRepos } from '@/lib/repositories';
import { callTask } from '@/lib/api/ai-client';
import { ApiError } from '@/lib/api/client';
import { buildExclusionSet } from '@/lib/corpus/exclude';
import { apiErrorKey, ERROR_KEY } from '@/lib/i18n/api-error';
import { chunkUnits, type UnitChunk } from '@/lib/documents/extract';
import type { CandidateWord, Cefr, Import, KnownState } from '@/lib/domain';

// docs/decision.md ADR-021 — a document is chunked into ~MAX_CHARS_PER_BATCH-sized
// pieces (one real PDF page or paragraph never split across two chunks, see
// chunkUnits) and every chunk is analyzed in ONE round of concurrent AI calls, not
// one call per page — the endpoint is a remote cloud call, not local CPU, so
// there's no reason to serialize them. MAX_UNITS caps total pages/paragraphs
// considered so one huge document can't fan out into an unbounded burst of calls.
const MAX_CHARS_PER_BATCH = 6000;
const MAX_UNITS = 20;

interface AnalyzeInput {
  units: string[];
  unitLabel: 'page' | 'part';
  fileName: string;
  kind: Import['kind'];
  level: Cefr;
  contextTopic: string;
  goal: string;
}

interface SaveTriageResult {
  added: number;
  skipped: number;
}

interface BatchProgress {
  completed: number;
  total: number;
}

interface DocStoreState {
  status: 'idle' | 'analyzing' | 'ready' | 'saving' | 'done' | 'error';
  importId: string | null;
  fileName: string | null;
  candidates: CandidateWord[];
  unitLabel: 'page' | 'part';
  totalUnits: number;
  truncatedAtUnit: number | null;
  /** true when at least one batch failed but others still produced candidates —
   * the result is real but partial, surfaced as a notice rather than an error. */
  degraded: boolean;
  progress: BatchProgress | null;
  /** What the last saveTriage() wrote — the success screen's only input. Lives
   * here, not in components/learn/doc-result.tsx's local state, because that
   * state died with the component on a tab switch while `status` (a module-level
   * zustand singleton) stayed 'done' — so returning to /learn re-rendered the
   * whole triage list as if nothing had been saved. */
  savedResult: SaveTriageResult | null;
  /** A marked i18n key, not a sentence (lib/i18n/api-error.ts). Also what gets
   * PERSISTED via imports.fail(), so reopening a failed import months later shows
   * the message in the language the reader is using now, not the one that was
   * active when it failed. Rows written before this change hold plain Vietnamese,
   * which has no marker and renders verbatim — nothing to backfill. */
  errorKey: string | null;
  analyze(input: AnalyzeInput): Promise<void>;
  saveTriage(choices: Record<string, KnownState>, now: number): Promise<SaveTriageResult>;
  open(importId: string): Promise<void>;
  reset(): void;
}

async function analyzeChunk(
  chunk: UnitChunk,
  ctx: { level: Cefr; contextTopic: string; excludeWords: string[]; goal: string },
): Promise<CandidateWord[]> {
  const result = await callTask(
    'analyzeDocument',
    {
      documentText: chunk.text,
      level: ctx.level,
      contextTopic: ctx.contextTopic,
      excludeWords: ctx.excludeWords,
      goal: ctx.goal,
    },
    // retries: 1 (not the usual 0) is deliberate here — every chunk fires at once,
    // so a burst past the task's rate limit is expected, not exceptional. postJson
    // already reads the rate limiter's `retry-after` header and backs off by
    // exactly that long before retrying, which is exactly the smoothing this
    // needs; a slow/failed generation retried again would cost more time, but that
    // trade favors covering more of the document over a hard timeout. 85s client
    // vs the task's 70s server timeout — same margin pattern as work-store.ts.
    { timeoutMs: 85_000, retries: 1 },
  );
  return result.candidates.map((c) => ({ ...c, triage: null }));
}

/**
 * Orchestrates the "tải tài liệu -> đào từ vựng -> phân loại 3 mức" flow
 * (docs/decision.md ADR-021, reviving analyzeDocument per ADR-020) — same shape as
 * work-store.ts (store owns the AI call + persistence, the Learn page stays
 * presentational, docs/architecture.md §1) but kept as its own store rather than a
 * mode on work-store: different output type (candidates vs 4 insight arrays),
 * different persisted field (setCandidates vs setAnalysis), different save path.
 */
export const useDocStore = create<DocStoreState>()((set, get) => ({
  status: 'idle',
  importId: null,
  fileName: null,
  candidates: [],
  unitLabel: 'page',
  totalUnits: 0,
  truncatedAtUnit: null,
  degraded: false,
  progress: null,
  savedResult: null,
  errorKey: null,

  async analyze({ units, unitLabel, fileName, kind, level, contextTopic, goal }) {
    set({
      status: 'analyzing',
      candidates: [],
      unitLabel,
      totalUnits: units.length,
      degraded: false,
      progress: null,
      savedResult: null,
      errorKey: null,
    });
    const repos = getRepos();
    const created = await repos.imports.create({ fileName, kind, rawText: units.join('\n\n') });
    set({ importId: created.id, fileName });

    const { chunks, truncatedAtUnit } = chunkUnits(units, MAX_CHARS_PER_BATCH, MAX_UNITS);
    set({ truncatedAtUnit, progress: { completed: 0, total: chunks.length } });

    // buildExclusionSet unions the notebook + `skipped` ("Đã biết rõ") — a word the
    // user already marked known must never resurface. Computed once and reused
    // identically for every chunk (they all fire concurrently, so there's no
    // "earlier chunk's finds" to feed forward) — any duplicate a word gets
    // suggested across two chunks is caught by the word-dedup merge below instead.
    const excludeWords = [...(await buildExclusionSet())].slice(0, 500);

    const settled = await Promise.allSettled(
      chunks.map((chunk) =>
        analyzeChunk(chunk, { level, contextTopic, excludeWords, goal }).finally(() => {
          set((s) => (s.progress ? { progress: { ...s.progress, completed: s.progress.completed + 1 } } : {}));
        }),
      ),
    );

    const seen = new Set<string>();
    const allCandidates: CandidateWord[] = [];
    let anySucceeded = false;
    let anyFailed = false;
    for (const outcome of settled) {
      if (outcome.status === 'fulfilled') {
        anySucceeded = true;
        for (const candidate of outcome.value) {
          const key = candidate.word.trim().toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          allCandidates.push(candidate);
        }
      } else {
        anyFailed = true;
      }
    }

    if (!anySucceeded) {
      const firstRejection = settled.find((s): s is PromiseRejectedResult => s.status === 'rejected');
      const errorKey =
        firstRejection?.reason instanceof ApiError
          ? apiErrorKey(firstRejection.reason.code)
          : ERROR_KEY.docFailed;
      await repos.imports.fail(created.id, errorKey);
      set({ status: 'error', errorKey, progress: null });
      return;
    }

    await repos.imports.setCandidates(created.id, allCandidates);
    set({ candidates: allCandidates, status: 'ready', progress: null, degraded: anyFailed });
  },

  async saveTriage(choices, now) {
    const { candidates, importId, fileName } = get();
    if (!importId) return { added: 0, skipped: 0 };
    set({ status: 'saving' });

    const repos = getRepos();
    let added = 0;
    let skipped = 0;

    for (const candidate of candidates) {
      const triage = choices[candidate.word] ?? candidate.triage;
      if (!triage) continue; // TriageList always supplies a default; skip only if truly absent
      // Persisted for every candidate, not only saved ones, so reopening this
      // import later (past-imports list) shows the choices already made.
      await repos.imports.setTriage(importId, candidate.word, triage);

      if (triage === 'known') {
        await repos.skipped.add(candidate.word, now);
        skipped += 1;
        continue;
      }
      await repos.words.addFromCorpus({
        word: candidate.word,
        meaningVi: candidate.meaningVi,
        exampleSentence: candidate.sentenceFromDoc,
        distractors: candidate.distractors,
        cefr: candidate.cefr,
        source: { kind: 'paste', label: `Tài liệu: ${fileName ?? 'tài liệu'}`, at: now },
        triage,
        now,
      });
      added += 1;
    }

    await repos.imports.complete(importId, added);
    const result = { added, skipped };
    set({ status: 'done', savedResult: result });
    return result;
  },

  async open(importId) {
    const row = await getRepos().imports.get(importId);
    if (!row) return;
    set({
      importId: row.id,
      fileName: row.fileName,
      candidates: row.candidates,
      truncatedAtUnit: null,
      degraded: false,
      progress: null,
      // Reopening a finished import from "Đã phân tích trước đó" shows its saved
      // triage choices again (row.candidates carries them), NOT the success
      // screen — that screen belongs to the save that just happened, not to a
      // history entry.
      savedResult: null,
      status: row.status === 'analyzing' ? 'analyzing' : row.status === 'failed' ? 'error' : row.status === 'done' ? 'done' : 'ready',
      errorKey: row.status === 'failed' ? row.error ?? null : null,
    });
  },

  reset() {
    set({
      status: 'idle',
      importId: null,
      fileName: null,
      candidates: [],
      totalUnits: 0,
      truncatedAtUnit: null,
      degraded: false,
      progress: null,
      savedResult: null,
      errorKey: null,
    });
  },
}));
