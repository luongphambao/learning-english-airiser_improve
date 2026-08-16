'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Info } from 'lucide-react';
import { useProfile } from '@/hooks/use-profile';
import { useWordsList } from '@/hooks/use-words';
import { BackHeader } from '@/components/layout/back-header';
import { Button } from '@/components/Button';
import { MetricChips } from '@/components/leaderboard/metric-chips';
import { Podium } from '@/components/leaderboard/podium';
import { RankRow } from '@/components/leaderboard/rank-row';
import { buildLeaderboard, buildMyEntry, getMetric } from '@/lib/leaderboard/metrics';
import type { LeaderboardEntry, LeaderboardMetricId } from '@/lib/leaderboard/types';

function secondaryLine(entry: LeaderboardEntry): string {
  const accuracy = entry.totalReviews > 0 ? Math.round((entry.totalCorrect / entry.totalReviews) * 100) : 0;
  return `${entry.totalReviews} lượt · ${accuracy}% đúng`;
}

export default function LeaderboardPage() {
  const { stats, settings } = useProfile();
  // Default useWordsList limit (500) would silently undercount a very large
  // notebook — here the count itself is the point, unlike /progress which only
  // ever renders a bounded list.
  const words = useWordsList({ limit: 2000 });
  const [metric, setMetric] = useState<LeaderboardMetricId>('words');
  const [now, setNow] = useState<number | null>(null);
  const myRowRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => setNow(Date.now()), []);

  const me = useMemo(
    () => (now === null ? null : buildMyEntry(stats, settings, words, now)),
    [stats, settings, words, now],
  );
  const ranked = useMemo(() => (me === null ? null : buildLeaderboard(me, metric)), [me, metric]);
  const activeMetric = getMetric(metric);
  const hasData = me !== null && (me.words > 0 || me.totalReviews > 0);
  const myRanked = ranked?.find((r) => r.entry.isMe) ?? null;

  return (
    <>
      <BackHeader title="Bảng xếp hạng" />
      <div className="space-y-6 animate-fade-in pt-6 pb-24">
        <div className="flex gap-3 rounded-card border border-amber/30 bg-amber/10 p-4">
          <Info size={18} className="text-amber shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-amber-ink">
            <span className="font-semibold">Bảng xếp hạng minh hoạ.</span> 20 người học trong danh sách là dữ liệu
            mẫu cố định, không phải người dùng thật. Chỉ dòng của bạn là số liệu thật, đọc từ sổ tay và lịch sử ôn
            tập trên máy này.
          </p>
        </div>

        <MetricChips value={metric} onChange={setMetric} />

        {ranked === null ? (
          <ul className="space-y-2" aria-hidden="true">
            <span className="sr-only">Đang tải bảng xếp hạng</span>
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="h-14 rounded-card border border-rule bg-surface" />
            ))}
          </ul>
        ) : (
          <>
            <Podium top3={ranked.slice(0, 3)} format={activeMetric.format} />

            <ul className="bg-surface border border-rule rounded-card divide-y divide-rule overflow-hidden">
              {ranked.map((r) => (
                <RankRow
                  key={r.entry.id}
                  ref={r.entry.isMe ? myRowRef : undefined}
                  ranked={r}
                  format={activeMetric.format}
                  secondary={secondaryLine}
                  showDash={!r.qualified || (r.entry.isMe && !hasData)}
                  nameOverride={r.entry.isMe && !hasData ? 'Bạn — mới bắt đầu' : undefined}
                />
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="sticky bottom-0 z-30 -mx-4 border-t border-rule bg-paper/95 px-4 pt-3 pb-safe backdrop-blur-sm sm:mx-0 sm:rounded-card sm:border sm:px-4 sm:pb-3">
        {ranked === null ? null : hasData && myRanked ? (
          <div className="flex items-center justify-between gap-3 pb-3">
            <div>
              <span className="block text-[11px] text-ink-soft">Vị trí của bạn</span>
              <span className="font-mono-utility text-sm font-semibold text-ink">
                #{myRanked.rank} / {ranked.length}
                <span className="ml-2 font-normal text-ink-soft">{activeMetric.format(myRanked.entry)}</span>
              </span>
            </div>
            <Button
              variant="quiet"
              type="button"
              onClick={() => myRowRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })}
            >
              Xem dòng của bạn
            </Button>
          </div>
        ) : (
          <div className="space-y-2 pb-3">
            <p className="text-sm text-ink">
              <span className="font-semibold">Bạn chưa có dữ liệu để xếp hạng.</span> Thêm 5 từ đầu tiên vào sổ tay
              là bạn có mặt trên bảng.
            </p>
            <Link href="/placement">
              <Button variant="primary" className="w-full">
                Kiểm tra trình độ (2 phút)
              </Button>
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
