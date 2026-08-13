'use client';

import React from 'react';
import { useProfile } from '@/hooks/use-profile';
import { useWordsList } from '@/hooks/use-words';
import { WordCard } from '@/components/WordCard';
import { BackHeader } from '@/components/layout/back-header';
import { Flame, CheckCircle2, RotateCcw, Calendar, BarChart2 } from 'lucide-react';
import { dayKey, lastNDays, weekdayVi } from '@/lib/srs/date';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: { day: string; date: string; reviews: number } }>;
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-surface border border-rule rounded-xl p-3 shadow-card text-xs font-sans">
        <p className="font-semibold text-ink">{data.day} ({data.date})</p>
        <p className="text-green font-mono-utility mt-1">
          Lượt ôn tập: <span className="font-bold">{data.reviews} lượt</span>
        </p>
      </div>
    );
  }
  return null;
}

// Rewritten on hooks/use-profile.ts + hooks/use-words.ts (Phase 5); fake-data bugs
// fixed in Phase 7 (docs/progress/00-baseline-audit.md §I69-72):
// - the 7-day tracker now reads stats.history (real per-day review counts) instead
//   of hardcoding Mon-Fri complete for everyone forever.
// - accuracy falls back to 0%, not a misleadingly perfect 100%, for a user with no
//   reviews yet.
// - the "you started on {date}" line no longer always says today — it derives from
//   the earliest word's createdAt (skipped entirely for an empty notebook), since
//   UserStats has no signup/account-creation timestamp to read from.
export default function ProgressPage() {
  const { stats } = useProfile();
  const words = useWordsList();

  const knownWordsCount = words.filter((w) => w.status === 'known').length;
  const learningWordsCount = words.filter((w) => w.status === 'learning').length;
  const leechWords = words.filter((w) => w.isLeech);

  const accuracy = stats.totalReviews > 0
    ? Math.round((stats.totalCorrect / stats.totalReviews) * 100)
    : 0;

  const last7Days = React.useMemo(() => lastNDays(dayKey(Date.now()), 7), []);
  const earliestWordDate = words.length > 0
    ? Math.min(...words.map((w) => w.createdAt))
    : null;

  const chartData = React.useMemo(() => {
    return last7Days.map((key) => {
      const isToday = key === last7Days[last7Days.length - 1];
      const count = stats.history[key] ?? 0;
      return {
        key,
        day: weekdayVi(key),
        date: key,
        reviews: count,
        fill: isToday ? 'var(--green)' : 'var(--rule)',
      };
    });
  }, [last7Days, stats.history]);

  const reviewsLast7Days = React.useMemo(() => {
    return last7Days.reduce((sum, key) => sum + (stats.history[key] ?? 0), 0);
  }, [last7Days, stats.history]);

  return (
    <>
      <BackHeader title="Tiến độ" />
      <div className="space-y-6 animate-fade-in pt-6">
        <div className="bg-green rounded-card p-6 sm:p-8 text-paper">
          <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-3 inline-block">
            Tổng quan tiến độ
          </span>
          <h1 className="font-serif-display text-2xl sm:text-3xl mb-2">Thói quen học tập mỗi ngày</h1>
          <p className="text-paper/80 text-sm sm:text-base max-w-md">
            Duy trì 3 phút ôn tập từ vựng & ngữ pháp để đạt sự tự tin tối đa trong công việc.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-surface border border-rule rounded-card p-4 text-center">
            <span className="text-xs font-mono-utility text-ink-soft uppercase block mb-1">Chuỗi ngày</span>
            <div className="flex items-center justify-center gap-1.5 text-2xl sm:text-3xl font-bold text-amber-ink font-mono-utility">
              <Flame size={24} className="fill-amber text-amber" />
              {stats.streak}
            </div>
            <span className="text-[11px] text-ink-soft block mt-1">Dài nhất: {stats.longestStreak} ngày</span>
          </div>

          <div className="bg-surface border border-rule rounded-2xl p-4 shadow-xs text-center">
            <span className="text-xs font-mono-utility text-ink-soft uppercase block mb-1">Từ đã thuộc</span>
            <div className="text-2xl sm:text-3xl font-bold text-green font-mono-utility">
              {knownWordsCount}
            </div>
            <span className="text-[11px] text-ink-soft block mt-1">Mức độ thuộc &gt;= 4</span>
          </div>

          <div className="bg-surface border border-rule rounded-2xl p-4 shadow-xs text-center">
            <span className="text-xs font-mono-utility text-ink-soft uppercase block mb-1">Đang học</span>
            <div className="text-2xl sm:text-3xl font-bold text-amber-ink font-mono-utility">
              {learningWordsCount}
            </div>
            <span className="text-[11px] text-ink-soft block mt-1">Đang ôn tập định kỳ</span>
          </div>

          <div className="bg-surface border border-rule rounded-2xl p-4 shadow-xs text-center">
            <span className="text-xs font-mono-utility text-ink-soft uppercase block mb-1">Lượt bài tập</span>
            <div className="text-2xl sm:text-3xl font-bold text-ink font-mono-utility">
              {stats.totalReviews}
            </div>
            <span className="text-[11px] text-ink-soft block mt-1">Đúng {accuracy}%</span>
          </div>
        </div>

        {/* Recharts Chart for 7 Days Total Reviews */}
        <div className="bg-surface border border-rule rounded-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart2 size={18} className="text-green" />
              <div>
                <h3 className="font-semibold text-base text-ink">Biểu đồ lượt ôn tập (7 ngày qua)</h3>
                <p className="text-xs text-ink-soft">Tổng số lượt ôn: <span className="font-mono-utility font-semibold text-ink">{reviewsLast7Days}</span> lượt</p>
              </div>
            </div>
            <span className="text-xs font-mono-utility text-green font-semibold">Tỉ lệ đúng {accuracy}%</span>
          </div>

          <div className="h-56 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--rule)" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12, fill: 'var(--ink-soft)' }}
                  axisLine={{ stroke: 'var(--rule)' }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: 'var(--ink-soft)' }}
                  axisLine={{ stroke: 'var(--rule)' }}
                  tickLine={false}
                />
                <Tooltip
                  content={(props) => <CustomTooltip active={props.active} payload={props.payload as unknown as TooltipProps['payload']} />}
                  cursor={{ fill: 'var(--green-wash)', opacity: 0.5 }}
                />
                <Bar dataKey="reviews" radius={[6, 6, 0, 0]} fill="var(--rule)">
                  {chartData.map((entry) => (
                    <Cell key={entry.key} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-surface border border-rule rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-green" />
              <h3 className="font-semibold text-base text-ink">Hoạt động 7 ngày qua</h3>
            </div>
            <span className="text-xs font-mono-utility text-green font-semibold">Tỉ lệ đúng {accuracy}%</span>
          </div>

          <div className="grid grid-cols-7 gap-2 text-center pt-2">
            {last7Days.map((key) => {
              const isCompleted = (stats.history[key] ?? 0) > 0;
              const isToday = key === last7Days[last7Days.length - 1];
              return (
                <div key={key} className="flex flex-col items-center gap-1.5">
                  <div
                    className={`w-full h-10 rounded-xl flex items-center justify-center transition-all ${
                      isCompleted
                        ? 'bg-green text-paper shadow-xs'
                        : isToday
                        ? 'bg-paper border-2 border-dashed border-rule text-ink-soft'
                        : 'bg-paper border border-rule text-ink-soft'
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 size={16} /> : <div className="w-2 h-2 rounded-full bg-rule" />}
                  </div>
                  <span className="text-[11px] font-mono-utility text-ink-soft">{weekdayVi(key)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {leechWords.length > 0 && (
          <div className="bg-surface border border-wrong/30 rounded-card p-6 space-y-3">
            <div className="flex items-center gap-2 text-wrong">
              <RotateCcw size={18} />
              <h3 className="font-semibold text-base">Từ vựng hay trả lời sai ({leechWords.length})</h3>
            </div>
            <p className="text-xs text-ink-soft">
              Các từ này sẽ tự động chuyển sang chế độ gõ tự luận hoặc nghe để giúp bạn khắc sâu trí nhớ.
            </p>
            <div className="space-y-3 pt-2">
              {leechWords.map((word) => (
                <WordCard key={word.id} word={word} showDetails={false} />
              ))}
            </div>
          </div>
        )}

        {earliestWordDate && (
          <div className="text-center text-xs font-mono-utility text-ink-soft pt-2" suppressHydrationWarning>
            Bạn bắt đầu hành trình học cùng Lexio từ {new Date(earliestWordDate).toLocaleDateString('vi-VN')}
          </div>
        )}
      </div>
    </>
  );
}

