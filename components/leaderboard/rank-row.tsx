'use client';

import { forwardRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useT } from '@/hooks/use-i18n';
import type { LeaderboardEntry, RankedEntry } from '@/lib/leaderboard/types';

interface RankRowProps {
  ranked: RankedEntry;
  format: (entry: LeaderboardEntry) => string;
  secondary: (entry: LeaderboardEntry) => string;
  // The rank number is computed either way (rankBy stays pure and always numeric);
  // this only swaps the *display* to a dash — for an unqualified accuracy sample,
  // or for "my row" before the current user has any data at all.
  showDash: boolean;
  nameOverride?: string;
}

export const RankRow = forwardRef<HTMLLIElement, RankRowProps>(function RankRow(
  { ranked, format, secondary, showDash, nameOverride },
  ref,
) {
  const { t } = useT();
  const { entry, rank } = ranked;
  const [open, setOpen] = useState(false);
  const hasWords = entry.sampleWords.length > 0;
  const panelId = `leaderboard-words-${entry.id}`;

  return (
    <li ref={ref} aria-current={entry.isMe ? 'true' : undefined} className={entry.isMe ? 'bg-green-wash' : ''}>
      <button
        type="button"
        onClick={() => hasWords && setOpen((v) => !v)}
        aria-expanded={hasWords ? open : undefined}
        aria-controls={hasWords ? panelId : undefined}
        className={`flex w-full items-center gap-3 px-4 py-3 text-left ${hasWords ? 'cursor-pointer hover:bg-green-wash/60' : 'cursor-default'}`}
      >
        <span className="w-8 shrink-0 text-right font-mono-utility text-sm text-ink-soft">
          {showDash ? '—' : `#${rank}`}
        </span>
        <div
          className={`w-9 h-9 shrink-0 rounded-full grid place-items-center text-xs font-semibold ${
            entry.isMe ? 'bg-green text-paper' : 'bg-green-wash text-green'
          }`}
        >
          {entry.initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className={`truncate text-sm ${entry.isMe ? 'font-semibold text-green' : 'text-ink'}`}>
              {nameOverride ?? entry.name}
            </span>
            <span
              className={`shrink-0 rounded-full border px-1.5 py-0.5 font-mono-utility text-[10px] ${
                entry.isMe ? 'border-green text-green' : 'border-rule text-ink-soft'
              }`}
            >
              {entry.level}
            </span>
            {!entry.isMe && (
              <span className="shrink-0 text-[10px] text-ink-soft">{t('leaderboardPage.sampleBadge')}</span>
            )}
          </div>
          <p className="truncate text-[11px] text-ink-soft">{secondary(entry)}</p>
        </div>
        <span className="shrink-0 font-mono-utility text-sm text-ink">{showDash ? '—' : format(entry)}</span>
        {hasWords && (
          <ChevronDown
            size={14}
            className={`shrink-0 text-ink-soft transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        )}
      </button>
      {hasWords && open && (
        <div id={panelId} className="flex flex-wrap gap-1.5 px-4 pb-3 pl-[4.75rem]">
          {entry.sampleWords.map((w) => (
            <span key={w} className="rounded-full border border-rule bg-paper px-2 py-0.5 text-[11px] text-ink-soft">
              {w}
            </span>
          ))}
        </div>
      )}
    </li>
  );
});
