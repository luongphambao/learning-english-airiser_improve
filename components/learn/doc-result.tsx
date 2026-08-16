'use client';

import Link from 'next/link';
import { Loader2, AlertTriangle, CheckCircle2, RotateCcw, Info } from 'lucide-react';
import { useT } from '@/hooks/use-i18n';
import { Button } from '@/components/Button';
import { TriageList, type TriageListItem } from '@/components/TriageList';
import { useDocStore } from '@/stores/doc-store';
import type { KnownState } from '@/lib/domain';

// The result half of the "tải tài liệu -> đào từ vựng -> phân loại 3 mức" flow
// (docs/decision.md ADR-021) — mirrors the shape of Learn's work-mode result
// screen (analyzing/ready/done/error) but reads its own store, since a
// CandidateWord[] triage screen has nothing in common with WorkAnalysis's 4
// insight arrays.

export function DocResult({ onStartOver }: { onStartOver: () => void }) {
  const {
    status, candidates, unitLabel, totalUnits, truncatedAtUnit, degraded, progress, error, fileName,
    savedResult, saveTriage,
  } = useDocStore();
  const { t } = useT();

  async function handleConfirm(choices: Record<string, KnownState>) {
    await saveTriage(choices, Date.now());
  }

  if (status === 'analyzing') {
    const unitWord = t(`learnDoc.unit.${unitLabel}`);
    const percent = progress && progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
    return (
      <div className="py-20 text-center space-y-4">
        <Loader2 size={40} className="mx-auto text-green animate-spin" />
        <p className="font-serif-display text-2xl text-ink">{t('learnDoc.analyzing.heading')}</p>

        <div className="max-w-xs mx-auto">
          <div
            className="h-2 rounded-full bg-rule/40 overflow-hidden"
            role="progressbar"
            aria-label={t('learnDoc.analyzing.ariaLabel')}
            aria-valuenow={progress ? progress.completed : 0}
            aria-valuemin={0}
            aria-valuemax={progress ? progress.total : 0}
          >
            <div
              className="h-full bg-green rounded-full transition-[width] duration-500 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-2 text-xs font-mono-utility text-ink-soft">
            {progress
              ? t('learnDoc.analyzing.progressLabel', { completed: progress.completed, total: progress.total, percent })
              : t('learnDoc.analyzing.preparingProgress')}
          </p>
        </div>

        <p className="text-sm text-ink-soft">
          {progress
            ? t('learnDoc.analyzing.unitsInfo', { count: totalUnits, unit: unitWord })
            : t('learnDoc.analyzing.preparingInfo')}
        </p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="py-20 text-center space-y-4">
        <AlertTriangle size={48} className="mx-auto text-wrong" />
        <p className="font-serif-display text-2xl text-ink">{t('learnDoc.error.heading')}</p>
        <p className="text-sm text-ink-soft max-w-sm mx-auto">{error ?? t('learnDoc.error.fallback')}</p>
        <Button variant="primary" onClick={onStartOver}>
          {t('learnDoc.error.retry')}
        </Button>
      </div>
    );
  }

  if (savedResult) {
    return (
      <div className="py-20 text-center space-y-4">
        <CheckCircle2 size={48} className="mx-auto text-green" />
        <p className="font-serif-display text-2xl text-ink">{t('learnDoc.success.heading', { count: savedResult.added })}</p>
        <p className="text-sm text-ink-soft">
          {savedResult.skipped > 0
            ? t('learnDoc.success.skippedNote', { count: savedResult.skipped })
            : t('learnDoc.success.readyNote')}
        </p>
        <div className="flex flex-wrap gap-2 justify-center pt-2">
          <Button variant="quiet" onClick={onStartOver}>
            <RotateCcw size={16} />
            {t('learnDoc.success.startOver')}
          </Button>
          <Link href="/vocabulary">
            <Button variant="quiet">{t('learnDoc.success.openNotebook')}</Button>
          </Link>
          <Link href="/practice">
            <Button variant="primary">{t('learnDoc.success.practiceNow')}</Button>
          </Link>
        </div>
      </div>
    );
  }

  if ((status === 'ready' || status === 'saving' || status === 'done') && candidates.length > 0) {
    const items: TriageListItem[] = candidates.map((c) => ({
      id: c.word,
      word: c.word,
      vi: `${c.meaningVi}${c.cefr ? ` · ${c.cefr}` : ''}${t(`learnDoc.category.${c.category}`) ? ` · ${t(`learnDoc.category.${c.category}`)}` : ''}`,
      cefr: c.cefr,
      initialTriage: c.triage ?? undefined,
      note: c.sentenceFromDoc
        ? `"${c.sentenceFromDoc}" — ${c.sentenceSource === 'document' ? t('learnDoc.result.fromDocument') : t('learnDoc.result.fromAi')}`
        : undefined,
    }));

    const unitWord = t(`learnDoc.unit.${unitLabel}`);

    return (
      <div className="space-y-5 pb-24">
        <div>
          {/* Without this the triage screen is a one-way door: the Learn mode
              tabs only render in the idle state, so a user who opened the wrong
              document had no way back to the upload box except saving it. */}
          <button
            type="button"
            onClick={onStartOver}
            className="flex items-center gap-1.5 text-xs text-ink-soft hover:text-green transition-colors mb-3 cursor-pointer"
          >
            <RotateCcw size={13} />
            {t('learnDoc.success.startOver')}
          </button>
          <span className="font-mono-utility text-xs uppercase tracking-wider text-ink-soft block mb-1.5">
            {t('learnDoc.result.analyzedBy')}
          </span>
          <h1 className="font-serif-display text-3xl text-ink mb-2">
            {t('learnDoc.result.title', { fileName: fileName ?? t('learnDoc.result.untitledDoc') })}
          </h1>
          <p className="text-sm text-ink-soft">{t('learnDoc.result.subtitle', { count: candidates.length })}</p>
          {truncatedAtUnit !== null && (
            <p className="text-xs text-ink-soft flex items-center gap-1.5 mt-2">
              <Info size={14} />
              {t('learnDoc.result.truncatedNotice', { count: truncatedAtUnit, unit: unitWord })}
            </p>
          )}
          {degraded && (
            <p className="text-xs text-ink-soft flex items-center gap-1.5 mt-2">
              <AlertTriangle size={14} />
              {t('learnDoc.result.degradedNotice')}
            </p>
          )}
        </div>
        <TriageList
          items={items}
          onConfirm={handleConfirm}
          confirming={status === 'saving'}
          confirmLabel={t('learnDoc.result.confirmLabel')}
        />
      </div>
    );
  }

  return null;
}
