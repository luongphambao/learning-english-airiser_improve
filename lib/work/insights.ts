import type { TaskOutput } from '@/lib/ai/tasks/contracts';
import type { EntryType, WorkAnalysis, WorkInsight, WorkInsightKind, WorkRewriteCard } from '@/lib/domain';

// Pure, clock-free, no I/O — flattens the AI task's 4 heterogeneous arrays
// (lib/ai/tasks/contracts.ts AnalyzeWorkOutput) into the normalized WorkAnalysis
// shape the Learn result screen and the save flow both consume (docs/decision.md
// ADR-014). Kept separate from the AI task layer so it's unit-testable without any
// provider/network involved, and separate from lib/domain/work.ts so the wire
// schema (no `.nullable()`, see lib/ai/gemini-schema.ts) and the persisted domain
// schema (`.nullable()` is fine) can diverge freely.
export function mapAnalyzeWorkOutput(out: TaskOutput<'analyzeWork'>): WorkAnalysis {
  const insights: WorkInsight[] = [
    ...out.words.map(
      (w, i): WorkInsight => ({
        id: `vocab-${i}`,
        kind: 'vocab',
        text: w.text,
        meaningVi: w.meaningVi,
        noteVi: w.whyVi,
        exampleSentence: w.exampleSentence,
        distractors: w.distractors,
        originalText: null,
        ruleLabel: null,
        cefr: w.cefr,
        saved: true,
      }),
    ),
    ...out.phrases.map(
      (p, i): WorkInsight => ({
        id: `phrase-${i}`,
        kind: 'phrase',
        text: p.text,
        meaningVi: p.meaningVi,
        noteVi: p.usageVi,
        exampleSentence: p.exampleSentence,
        distractors: p.distractors,
        originalText: null,
        ruleLabel: null,
        cefr: null,
        saved: true,
      }),
    ),
    ...out.grammarInsights.map(
      (g, i): WorkInsight => ({
        id: `grammar-${i}`,
        kind: 'grammar',
        text: g.focusWord,
        meaningVi: g.corrected,
        noteVi: g.explanationVi,
        exampleSentence: g.corrected,
        distractors: g.distractors,
        originalText: g.original,
        ruleLabel: g.rule,
        cefr: null,
        saved: true,
      }),
    ),
  ];

  const rewrites: WorkRewriteCard[] = out.professionalRewrites.map((r, i) => ({
    id: `rewrite-${i}`,
    original: r.original,
    rewrite: r.rewrite,
    reasonVi: r.reasonVi,
    keyPhrase: r.keyPhrase,
    saved: false, // has its own explicit "Lưu cụm từ ..." button, not a bulk checkbox
  }));

  return { summary: out.summary, insights, rewrites };
}

/** Which Word.entryType a saved insight becomes — total over WorkInsightKind. */
export function entryTypeForInsight(kind: WorkInsightKind): EntryType {
  switch (kind) {
    case 'vocab':
      return 'word';
    case 'phrase':
      return 'phrase';
    case 'grammar':
      return 'grammar';
  }
}
