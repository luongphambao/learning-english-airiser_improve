import { Crown } from 'lucide-react';
import type { LeaderboardEntry, RankedEntry } from '@/lib/leaderboard/types';

interface PodiumProps {
  top3: RankedEntry[];
  format: (entry: LeaderboardEntry) => string;
}

const COLUMN_ORDER = [1, 0, 2]; // silver, gold, bronze — gold rendered tallest in the middle

export function Podium({ top3, format }: PodiumProps) {
  if (top3.length < 3) return null;

  return (
    <div className="grid grid-cols-3 items-end gap-2">
      {COLUMN_ORDER.map((i) => {
        const { entry, rank } = top3[i];
        const isFirst = i === 1;
        const circleColor = entry.isMe ? 'bg-green text-paper' : 'bg-green-wash text-green';
        const circleBorder = isFirst ? 'border-amber' : entry.isMe ? 'border-green' : 'border-rule';

        return (
          <div key={entry.id} className={`flex min-w-0 flex-col items-center gap-1.5 ${isFirst ? '' : 'pb-4'}`}>
            <div className="relative">
              {isFirst && (
                <Crown
                  size={16}
                  className="absolute -top-4 left-1/2 -translate-x-1/2 text-amber fill-amber"
                  aria-hidden="true"
                />
              )}
              <div
                className={`w-12 h-12 rounded-full grid place-items-center font-serif-display text-lg border-2 ${circleColor} ${circleBorder}`}
              >
                {entry.initials}
              </div>
            </div>
            <span className="font-mono-utility text-[11px] text-ink-soft">#{rank}</span>
            <span
              className={`max-w-full truncate text-[11px] ${entry.isMe ? 'font-semibold text-green' : 'text-ink'}`}
            >
              {entry.name}
            </span>
            <span className="rounded-full border border-rule px-1.5 py-0.5 font-mono-utility text-[9px] text-ink-soft">
              {entry.level}
            </span>
            <span className="font-mono-utility text-xs font-semibold text-ink">{format(entry)}</span>
          </div>
        );
      })}
    </div>
  );
}
