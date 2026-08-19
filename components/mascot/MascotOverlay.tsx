'use client';

import { useRef, useState } from 'react';
import { useProfile } from '@/hooks/use-profile';
import { useDailyPlan } from '@/hooks/use-daily-plan';
import { useT } from '@/hooks/use-i18n';
import { Mascot, type MascotMood } from './Mascot';

const BUBBLE_TIMEOUT_MS = 4500;

/**
 * The floating mascot mounted once in app/providers.tsx, next to
 * LegacyClaimBanner/SyncScheduler, so it survives every route change instead
 * of remounting per page (docs/decision.md ADR-030). Purely a motivational
 * nudge — it reads real stats/plan data already computed for Today
 * (hooks/use-profile.ts, hooks/use-daily-plan.ts) rather than inventing its
 * own numbers, and writes nothing back.
 */
export function MascotOverlay() {
  const { stats } = useProfile();
  const plan = useDailyPlan();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const remaining = plan.dueCount + plan.freshCount;
  const mood: MascotMood = remaining === 0 && plan.totalWords > 0 ? 'happy' : 'idle';

  function pickLine(): string {
    if (plan.totalWords === 0) {
      const key = `mascot.linesStart${1 + Math.floor(Math.random() * 3)}`;
      return t(key);
    }
    if (remaining === 0) {
      const key = `mascot.linesCaughtUp${1 + Math.floor(Math.random() * 3)}`;
      return t(key);
    }
    const key = `mascot.linesEncourage${1 + Math.floor(Math.random() * 3)}`;
    return t(key, { streak: stats.streak });
  }

  const [line, setLine] = useState('');

  function toggle() {
    if (open) {
      setOpen(false);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      return;
    }
    setLine(pickLine());
    setOpen(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setOpen(false), BUBBLE_TIMEOUT_MS);
  }

  return (
    <div className="fixed right-4 above-nav z-30 mb-4 flex flex-col items-end gap-2 pointer-events-none">
      {open && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-auto max-w-[13rem] rounded-card bg-surface border border-rule shadow-card px-3 py-2 text-xs text-ink animate-fade-in"
        >
          {line}
        </div>
      )}
      <button
        type="button"
        onClick={toggle}
        aria-label={t('mascot.ariaLabel')}
        aria-expanded={open}
        className="pointer-events-auto rounded-full hover:scale-105 active:scale-95 transition-transform cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-green focus-visible:outline-offset-2"
      >
        <Mascot mood={mood} size={52} />
      </button>
    </div>
  );
}
