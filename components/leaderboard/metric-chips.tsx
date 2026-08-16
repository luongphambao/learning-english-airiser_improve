import { BookMarked, Flame, Repeat2, Target, Sparkles, Swords } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { METRICS } from '@/lib/leaderboard/metrics';
import type { LeaderboardMetricId } from '@/lib/leaderboard/types';

// Icon assignment lives here, not in lib/leaderboard/, so metrics.ts stays
// importable from a node-environment vitest run with no JSX transform.
const METRIC_ICONS: Record<LeaderboardMetricId, LucideIcon> = {
  words: BookMarked,
  longestStreak: Flame,
  totalReviews: Repeat2,
  accuracy: Target,
  newLast7: Sparkles,
  leechesConquered: Swords,
};

interface MetricChipsProps {
  value: LeaderboardMetricId;
  onChange: (id: LeaderboardMetricId) => void;
}

export function MetricChips({ value, onChange }: MetricChipsProps) {
  const active = METRICS.find((m) => m.id === value) ?? METRICS[0];

  return (
    <div className="space-y-2">
      <div
        role="tablist"
        aria-label="Chọn tiêu chí xếp hạng"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 sm:overflow-visible"
      >
        {METRICS.map((m) => {
          const Icon = METRIC_ICONS[m.id];
          const isActive = m.id === value;
          return (
            <button
              key={m.id}
              role="tab"
              aria-selected={isActive}
              type="button"
              onClick={() => onChange(m.id)}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                isActive
                  ? 'border-green bg-green text-paper'
                  : 'border-rule bg-surface text-ink-soft hover:text-ink'
              }`}
            >
              <Icon size={14} />
              {m.label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-ink-soft">{active.hint}</p>
    </div>
  );
}
