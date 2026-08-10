'use client';

import React from 'react';
import { useProfile } from '@/hooks/use-profile';
import { useWordsList } from '@/hooks/use-words';
import { WordCard } from '@/components/WordCard';
import { BackHeader } from '@/components/layout/back-header';
import { Flame, CheckCircle2, RotateCcw, Calendar } from 'lucide-react';
import { dayKey, lastNDays, weekdayVi } from '@/lib/srs/date';

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

  return (
    <>
      <BackHeader title="Tiến độ" />
      <div className="space-y-6 animate-fade-in pt-6">
        <div className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-lg shadow-indigo-200/50 dark:shadow-none">
          <div className="relative z-10">
            <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-3 inline-block">
              Tổng quan tiến độ
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">Thói quen học tập mỗi ngày</h1>
            <p className="text-indigo-100 text-sm sm:text-base max-w-md">
              Duy trì 3 phút ôn tập từ vựng & ngữ pháp để đạt sự tự tin tối đa trong công việc.
            </p>
          </div>
          <div className="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-surface border border-rule rounded-2xl p-4 shadow-xs text-center">
            <span className="text-xs font-mono-utility text-ink-soft uppercase block mb-1">Chuỗi ngày</span>
            <div className="flex items-center justify-center gap-1.5 text-2xl sm:text-3xl font-bold text-amber-500 font-mono-utility">
              <Flame size={24} className="fill-amber-500" />
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
            <div className="text-2xl sm:text-3xl font-bold text-amber font-mono-utility">
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
                        ? 'bg-green text-white shadow-xs'
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
          <div className="bg-surface border border-rose-200 dark:border-rose-900/50 rounded-2xl p-6 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
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
