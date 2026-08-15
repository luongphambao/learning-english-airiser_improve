'use client';

import { useState } from 'react';
import type { Cefr, KnownState } from '@/lib/domain';
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
}

/** Spec §8.3, verbatim: cefr C1/C2 -> 'unknown'; B2 -> 'partial'; B1 (or anything
 * easier, or unspecified) -> 'known'. */
export function defaultTriageForCefr(cefr: Cefr | undefined): KnownState {
  if (cefr === 'C1' || cefr === 'C2') return 'unknown';
  if (cefr === 'B2') return 'partial';
  return 'known';
}

const OPTIONS: { value: KnownState; label: string }[] = [
  { value: 'known', label: 'Đã biết rõ' },
  { value: 'partial', label: 'Biết sơ sơ' },
  { value: 'unknown', label: 'Chưa biết' },
];

interface TriageListProps {
  items: TriageListItem[];
  onConfirm: (choices: Record<string, KnownState>) => void;
  confirmLabel?: string;
  confirming?: boolean;
}

export function TriageList({ items, onConfirm, confirmLabel = 'Xác nhận', confirming = false }: TriageListProps) {
  const [choices, setChoices] = useState<Record<string, KnownState>>(() =>
    Object.fromEntries(items.map((item) => [item.id, defaultTriageForCefr(item.cefr)])),
  );

  if (items.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {items.map((item) => (
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
      <Button variant="primary" onClick={() => onConfirm(choices)} disabled={confirming} className="w-full">
        {confirmLabel}
      </Button>
    </div>
  );
}
