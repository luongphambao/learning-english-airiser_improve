'use client';

import { useState } from 'react';
import type { Cefr, KnownState } from '@/lib/domain';
import { useT } from '@/hooks/use-i18n';
import { Button } from './Button';

// Spec §8.3's 3-level triage screen, reusable across three callers (docs/decision.md
// ADR-017): placement seeding (app/(stack)/placement/page.tsx), a corpus top-up
// preview, and the revived analyzeDocument flow. Each caller only needs to supply
// items + a save callback — this component owns the per-item state and the
// CEFR-driven default pre-selection.

export interface TriageListItem {
  id: string;
  word: string;
  vi: string;
  cefr?: Cefr;
  /** Pre-selects this choice over defaultTriageForCefr — used to reopen an import
   * whose triage was already saved (docs/decision.md ADR-021). */
  initialTriage?: KnownState;
  /** Muted line under `vi` — the document-upload flow (stores/doc-store.ts) shows
   * the source sentence here. */
  note?: string;
}

/** Spec §8.3, verbatim: cefr C1/C2 -> 'unknown'; B2 -> 'partial'; B1 (or anything
 * easier, or unspecified) -> 'known'. */
export function defaultTriageForCefr(cefr: Cefr | undefined): KnownState {
  if (cefr === 'C1' || cefr === 'C2') return 'unknown';
  if (cefr === 'B2') return 'partial';
  return 'known';
}

// Shown PAGE_SIZE at a time instead of the full list at once — a document that
// mines 30-50 candidate words used to dump every card into one long scroll
// with a single confirm button at the very bottom, which read as "học 1 lần
// cả đống từ" instead of a manageable batch. "Xem thêm" reveals the next
// PAGE_SIZE; already-reviewed cards stay visible (append, not replace), and
// the one confirm button at the end still saves everything in a single
// atomic write — see stores/doc-store.ts's saveTriage(), which processes the
// full candidate list in one pass and marks the import complete, so it isn't
// designed for a partial/resumable per-page save.
const PAGE_SIZE = 10;

interface TriageListProps {
  items: TriageListItem[];
  onConfirm: (choices: Record<string, KnownState>) => void;
  confirmLabel?: string;
  confirming?: boolean;
}

export function TriageList({ items, onConfirm, confirmLabel, confirming = false }: TriageListProps) {
  const { t } = useT();
  const [choices, setChoices] = useState<Record<string, KnownState>>(() =>
    Object.fromEntries(items.map((item) => [item.id, item.initialTriage ?? defaultTriageForCefr(item.cefr)])),
  );
  const [visibleCount, setVisibleCount] = useState(() => Math.min(PAGE_SIZE, items.length));

  if (items.length === 0) return null;

  const resolvedConfirmLabel = confirmLabel ?? t('components.triageList.confirmDefault');
  const OPTIONS: { value: KnownState; label: string }[] = [
    { value: 'known', label: t('components.triageList.optionKnown') },
    { value: 'partial', label: t('components.triageList.optionPartial') },
    { value: 'unknown', label: t('components.triageList.optionUnknown') },
  ];
  const visibleItems = items.slice(0, visibleCount);
  const remaining = items.length - visibleCount;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {visibleItems.map((item) => (
          <div key={item.id} className="p-4 rounded-card border border-rule bg-surface space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span lang="en" className="font-serif-display text-lg text-ink">
                {item.word}
              </span>
              {item.cefr && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono-utility bg-paper text-ink-soft border border-rule shrink-0">
                  {item.cefr}
                </span>
              )}
            </div>
            <p className="text-sm text-ink-soft">{item.vi}</p>
            {item.note && <p lang="en" className="text-xs text-ink-soft/70 italic leading-relaxed">{item.note}</p>}
            <div className="flex gap-1.5">
              {OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setChoices((c) => ({ ...c, [item.id]: opt.value }))}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                    choices[item.id] === opt.value
                      ? 'border-green bg-green-wash text-green'
                      : 'border-rule bg-paper text-ink-soft'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {remaining > 0 && (
        <Button
          variant="quiet"
          onClick={() => setVisibleCount((c) => Math.min(c + PAGE_SIZE, items.length))}
          className="w-full"
        >
          {t('components.triageList.showMore', { shown: Math.min(PAGE_SIZE, remaining), remaining })}
        </Button>
      )}
      <Button variant="primary" onClick={() => onConfirm(choices)} disabled={confirming} className="w-full">
        {items.length > PAGE_SIZE
          ? t('components.triageList.confirmWithCount', { label: resolvedConfirmLabel, count: items.length })
          : resolvedConfirmLabel}
      </Button>
    </div>
  );
}
