import { create } from 'zustand';
import { getRepos } from '@/lib/repositories';
import { callTask } from '@/lib/api/ai-client';
import { ApiError } from '@/lib/api/client';
import { mapAnalyzeWorkOutput, entryTypeForInsight } from '@/lib/work/insights';
import { useLevelStore } from './level-store';
import type { Cefr, WorkAnalysis } from '@/lib/domain';

interface AnalyzeInput {
  text: string;
  fileName: string;
  sourceType: 'email' | 'report' | 'chat' | 'other';
  level: Cefr;
  contextTopic: string;
  excludeWords: string[];
  goal: string;
}

interface WorkStoreState {
  status: 'idle' | 'analyzing' | 'ready' | 'saving' | 'done' | 'error';
  importId: string | null;
  fileName: string | null;
  analysis: WorkAnalysis | null;
  /** How many items the last saveSelected() wrote — the success screen's only
   * input. Lives here rather than in the Learn page's local state so the screen
   * survives a re-render, and so 'done' is a state the page can recognise on a
   * later mount instead of silently re-rendering the already-saved insight list
   * (which is what let the same batch be saved twice). */
  savedCount: number | null;
  error: string | null;
  analyze(input: AnalyzeInput): Promise<void>;
  toggleInsight(insightId: string): void;
  toggleRewrite(rewriteId: string): void;
  saveSelected(now: number): Promise<{ wordIds: string[]; count: number }>;
  open(importId: string): Promise<void>;
  reset(): void;
}

/**
 * Orchestrates "Học từ công việc thật" (docs/decision.md ADR-014) — follows the
 * enrichment-store/session-store precedent: the store owns the flow (AI call,
 * persistence), the Learn page stays presentational. No component here touches
 * Dexie or fetches /api/ai/* directly (docs/architecture.md §1).
 */
export const useWorkStore = create<WorkStoreState>()((set, get) => ({
  status: 'idle',
  importId: null,
  fileName: null,
  analysis: null,
  savedCount: null,
  error: null,

  async analyze({ text, fileName, sourceType, level, contextTopic, excludeWords, goal }) {
    set({ status: 'analyzing', error: null, analysis: null, savedCount: null });
    const repos = getRepos();
    const created = await repos.imports.create({ fileName, kind: 'work', rawText: text });
    set({ importId: created.id, fileName });
    try {
      // 65s client timeout vs the task's 50s server timeout, and no client-side
      // retry — a failed 50s call retried by postJson would leave the user
      // waiting up to 2 more minutes for a second attempt inside an already-tight
      // 5/min rate-limit bucket. withRetry already retries server-side (max 2)
      // within its own 50s budget.
      const result = await callTask(
        'analyzeWork',
        { workText: text, sourceType, level, contextTopic, excludeWords, goal },
        { timeoutMs: 65_000, retries: 0 },
      );
      const analysis = mapAnalyzeWorkOutput(result);
      await repos.imports.setAnalysis(created.id, analysis);
      set({ analysis, status: 'ready' });
      // docs/decision.md ADR-017 — this is where summary.estimatedLevel (parsed
      // since lib/ai/tasks/contracts.ts always returned it) finally lands instead of
      // being discarded. Fire-and-forget: a failed level update must not block the
      // Learn result screen the user is already looking at.
      void useLevelStore.getState().recordWorkSignal(analysis.summary.estimatedLevel as Cefr, Date.now());
    } catch (err) {
      const message = err instanceof ApiError ? err.messageVi : 'Không phân tích được văn bản. Thử lại sau.';
      await repos.imports.fail(created.id, message);
      set({ status: 'error', error: message });
    }
  },

  toggleInsight(insightId) {
    const { analysis } = get();
    if (!analysis) return;
    set({
      analysis: {
        ...analysis,
        insights: analysis.insights.map((i) => (i.id === insightId ? { ...i, saved: !i.saved } : i)),
      },
    });
  },

  toggleRewrite(rewriteId) {
    const { analysis } = get();
    if (!analysis) return;
    set({
      analysis: {
        ...analysis,
        rewrites: analysis.rewrites.map((r) => (r.id === rewriteId ? { ...r, saved: !r.saved } : r)),
      },
    });
  },

  async saveSelected(now) {
    const { analysis, importId, fileName } = get();
    if (!analysis || !importId) return { wordIds: [], count: 0 };
    set({ status: 'saving' });

    const repos = getRepos();
    const wordIds: string[] = [];

    for (const insight of analysis.insights) {
      if (!insight.saved) continue;
      const saved = await repos.words.addFromInsight({
        text: insight.text,
        entryType: entryTypeForInsight(insight.kind),
        source: { kind: 'paste', label: `Công việc: ${fileName ?? 'tài liệu'}`, at: now },
        meaningVi: insight.meaningVi,
        noteVi: insight.noteVi,
        exampleSentence: insight.exampleSentence,
        distractors: insight.distractors,
        originalText: insight.originalText,
        cefr: insight.cefr,
        now,
      });
      wordIds.push(saved.id);
    }

    for (const rewrite of analysis.rewrites) {
      if (!rewrite.saved) continue;
      const saved = await repos.words.addFromInsight({
        text: rewrite.keyPhrase,
        entryType: 'phrase',
        source: { kind: 'paste', label: `Công việc: ${fileName ?? 'tài liệu'}`, at: now },
        meaningVi: '',
        noteVi: rewrite.reasonVi,
        exampleSentence: rewrite.rewrite,
        distractors: [],
        originalText: rewrite.original,
        cefr: null, // a reusable phrase has no meaningful band
        now,
      });
      wordIds.push(saved.id);
    }

    await repos.imports.complete(importId, wordIds.length);
    // 'done', not back to 'ready': the analysis has been consumed. Returning to
    // 'ready' left the checked insight list on screen with a live "Thêm N mục"
    // button, so a second tap (or a remount after a tab switch) re-ran the whole
    // save against the same import.
    set({ status: 'done', savedCount: wordIds.length });
    return { wordIds, count: wordIds.length };
  },

  async open(importId) {
    const row = await getRepos().imports.get(importId);
    if (!row) return;
    set({
      importId: row.id,
      fileName: row.fileName,
      analysis: row.analysis ?? null,
      savedCount: null,
      status: row.status === 'analyzing' ? 'analyzing' : row.status === 'failed' ? 'error' : 'ready',
      error: row.status === 'failed' ? row.error ?? null : null,
    });
  },

  reset() {
    set({ status: 'idle', importId: null, fileName: null, analysis: null, savedCount: null, error: null });
  },
}));
