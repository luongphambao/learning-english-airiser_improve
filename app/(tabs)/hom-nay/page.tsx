'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionStore } from '@/stores/session-store';
import { useProfile } from '@/hooks/use-profile';
import { ExerciseFillBlank } from '@/components/ExerciseFillBlank';
import { ExerciseListen } from '@/components/ExerciseListen';
import { ExerciseWrite } from '@/components/ExerciseWrite';
import { ExerciseRecall } from '@/components/ExerciseRecall';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { CheckCircle2, Sparkles, BookOpen } from 'lucide-react';

// Rewritten on stores/session-store.ts (Phase 5) — replaces screens/TodayScreen.tsx.
// The two bugs that lived here (docs/progress/00-baseline-audit.md #10/#11) are now
// structurally impossible: `session.items` is built once by lib/srs/session.ts and
// never re-derived from the (mutating) word list, and `now` is always Date.now()
// passed explicitly to start()/answer() — no frozen module-level timestamp.
export default function TodayPage() {
  const router = useRouter();
  const { session, status, error, start, answer } = useSessionStore();
  const { stats, settings } = useProfile();

  useEffect(() => {
    if (status === 'idle') void start({ now: Date.now() });
  }, [status, start]);

  if (status === 'idle' || status === 'building') {
    return (
      <div className="py-16 text-center text-sm text-ink-soft font-mono-utility" aria-live="polite">
        Đang chuẩn bị bài học...
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="py-16 text-center text-sm text-wrong" role="alert">
        Không tải được bài học hôm nay. Kiểm tra kết nối rồi thử lại.
        {error ? <span className="block text-xs text-ink-soft mt-1 font-mono-utility">{error}</span> : null}
      </div>
    );
  }

  if (!session || session.items.length === 0) {
    return (
      <div className="py-8">
        <EmptyState
          icon={<CheckCircle2 size={32} className="text-green" />}
          title="Bạn đã hoàn thành bài học hôm nay!"
          description="Không còn từ nào cần ôn tập lúc này. Hãy thêm từ mới hoặc quay lại vào ngày mai."
          actionLabel="Đến Sổ từ để thêm từ mới"
          onAction={() => router.push('/so-tu')}
        />
      </div>
    );
  }

  if (session.status === 'done') {
    return (
      <div className="py-12 px-4 text-center max-w-md mx-auto bg-surface border border-rule rounded-[16px] shadow-xs">
        <div className="w-16 h-16 rounded-full bg-green-wash text-green flex items-center justify-center mx-auto mb-4">
          <Sparkles size={32} />
        </div>
        <h2 className="font-serif-display text-3xl sm:text-4xl text-ink mb-2">
          Xuất sắc! Đã học xong {session.items.length} từ.
        </h2>
        <p className="text-sm text-ink-soft mb-6">
          Chuỗi ngày học hiện tại: <span className="font-mono-utility font-semibold text-green">{stats.streak} ngày</span>
        </p>
        <Button variant="quiet" onClick={() => router.push('/so-tu')} className="w-full">
          Xem danh sách trong Sổ từ
        </Button>
      </div>
    );
  }

  const item = session.items[session.index];
  if (!item) return null;
  const word = item.snapshot;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-lg shadow-indigo-200/50 dark:shadow-none">
        <div className="relative z-10">
          <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3 inline-block">
            Bài học hôm nay
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Luyện từ vựng công sở</h1>
          <p className="text-indigo-100 text-sm sm:text-base max-w-md">
            Luyện tập {session.items.length} từ vựng then chốt hôm nay thông qua bài tập phản xạ, chọn từ và nghe phát âm.
          </p>
        </div>
        <div className="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none" />
      </div>

      <div className="flex items-center justify-between pb-3 border-b border-rule">
        <div className="flex items-center gap-2">
          <BookOpen size={18} className="text-indigo-600 dark:text-indigo-400" />
          <span className="text-xs font-mono-utility text-ink-soft font-semibold uppercase">
            Tiến độ câu hỏi
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="w-24 sm:w-32 h-2 bg-paper border border-rule rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={session.index + 1}
            aria-valuemin={1}
            aria-valuemax={session.items.length}
          >
            <div
              className="h-full bg-indigo-600 dark:bg-indigo-400 rounded-full transition-all duration-300"
              style={{ width: `${((session.index + 1) / session.items.length) * 100}%` }}
            />
          </div>
          <span className="font-mono-utility text-xs font-semibold text-ink">
            {session.index + 1} / {session.items.length}
          </span>
        </div>
      </div>

      {item.kind === 'fillBlank' && <ExerciseFillBlank word={word} onAnswer={answer} />}
      {item.kind === 'listen' && <ExerciseListen word={word} onAnswer={answer} />}
      {item.kind === 'write' && (
        <ExerciseWrite word={word} onAnswer={answer} contextTopic={settings.contextTopic} />
      )}
      {item.kind === 'recall' && <ExerciseRecall word={word} onAnswer={answer} />}
    </div>
  );
}
