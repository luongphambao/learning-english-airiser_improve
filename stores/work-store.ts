import { create } from 'zustand';
import { getRepos } from '@/lib/repositories';
import { callTask } from '@/lib/api/ai-client';
import { ApiError } from '@/lib/api/client';
import { mapAnalyzeWorkOutput, entryTypeForInsight } from '@/lib/work/insights';
import type { WorkAnalysis } from '@/lib/domain';

interface AnalyzeInput {
  text: string;
  fileName: string;
  sourceType: 'email' | 'report' | 'chat' | 'other';
  level: 'B1' | 'B2' | 'C1';
  contextTopic: string;
  excludeWords: string[];
}

interface WorkStoreState {
  status: 'idle' | 'analyzing' | 'ready' | 'saving' | 'error';
  importId: string | null;
  fileName: string | null;
  analysis: WorkAnalysis | null;
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
  error: null,

  async analyze({ text, fileName, sourceType, level, contextTopic, excludeWords }) {
    set({ status: 'analyzing', error: null, analysis: null });
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
        { workText: text, sourceType, level, contextTopic, excludeWords },
        { timeoutMs: 65_000, retries: 0 },
      );
      const analysis = mapAnalyzeWorkOutput(result);
      await repos.imports.setAnalysis(created.id, analysis);
      set({ analysis, status: 'ready' });
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
        now,
      });
      wordIds.push(saved.id);
    }

    await repos.imports.complete(importId, wordIds.length);
    set({ status: 'ready' });
    return { wordIds, count: wordIds.length };
  },

  async open(importId) {
    const row = await getRepos().imports.get(importId);
    if (!row) return;
    set({
      importId: row.id,
      fileName: row.fileName,
      analysis: row.analysis ?? null,
      status: row.status === 'analyzing' ? 'analyzing' : row.status === 'failed' ? 'error' : 'ready',
      error: row.status === 'failed' ? row.error ?? null : null,
    });
  },

  reset() {
    set({ status: 'idle', importId: null, fileName: null, analysis: null, error: null });
  },
}));
