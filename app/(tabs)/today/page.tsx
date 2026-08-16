'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useProfile } from '@/hooks/use-profile';
import { useDailyPlan } from '@/hooks/use-daily-plan';
import { useTopupStore } from '@/stores/topup-store';
import { Button } from '@/components/Button';
import { FileText, Upload, ChevronRight } from 'lucide-react';

// Home — answers "what should I do next?" instead of auto-starting a session
// (that used to happen here; the session itself moved to /practice unchanged,
// docs/decision.md ADR-013). No useSessionStore import: navigating to /today
// starts no session and writes nothing to Dexie.
export default function TodayPage() {
  const { stats, settings } = useProfile();
  const plan = useDailyPlan();
  const ensureSupply = useTopupStore((s) => s.ensureSupply);
  const [greeting, setGreeting] = useState('Chào bạn.');

  // new Date().getHours() would mismatch between SSR prerender and hydration if
  // computed at render time — resolve it client-side only, after mount, same
  // pattern as the suppressHydrationWarning clock reads elsewhere (calendar,
  // progress pages).
  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 11 ? 'Chào buổi sáng.' : h < 18 ? 'Chào buổi chiều.' : 'Chào buổi tối.');
  }, []);

  // docs/decision.md ADR-018 — fire-and-forget so words are already sitting in the
  // notebook by the time the user taps "Bắt đầu"; ensureSupply's own throttle (60s +
  // daily cap) makes repeated calls across re-renders cheap. Gated on `hasNotebook`
  // (computed below) deliberately: a brand-new, still-empty notebook must reach the
  // placement CTA in the `!hasNotebook` branch first, not get silently auto-filled
  // before the user ever sees it — the exact race that used to defeat seedIfEmpty().
  useEffect(() => {
    if (plan.totalWords === 0) return;
    if (plan.dueCount + plan.freshCount >= settings.sessionSize) return;
    void ensureSupply({ now: Date.now(), targetSize: settings.sessionSize });
  }, [plan.totalWords, plan.dueCount, plan.freshCount, settings.sessionSize, ensureSupply]);

  // docs/decision.md ADR-018 — settings.sessionSize, not a hardcoded constant, so
  // this count can't drift from what /practice actually serves.
  const practiceCount = Math.min(plan.dueCount + plan.freshCount, settings.sessionSize);
  const estimatedMinutes = Math.max(1, Math.round(practiceCount * 0.5)); // ~30s/thẻ
  const hasNotebook = plan.totalWords > 0;
  const hasWorkToday = practiceCount > 0;

  const accuracy = stats.totalReviews > 0 ? Math.round((stats.totalCorrect / stats.totalReviews) * 100) : null;

  // Priority ladder over real data only — no invented per-skill percentages.
  const focus =
    plan.leechCount > 0
      ? { text: `Bạn hay quên ${plan.leechCount} từ. Ôn lại trước tiên.`, href: '/practice' }
      : accuracy !== null && stats.totalReviews >= 10 && accuracy < 70
        ? { text: `Tỉ lệ đúng của bạn là ${accuracy}%. Luyện thêm để nhớ lâu hơn.`, href: '/practice' }
        : plan.totalWords < 10
          ? { text: 'Sổ tay còn ít từ. Thêm một tài liệu công việc để có nội dung học riêng.', href: '/learn' }
          : { text: `Bạn đang giữ nhịp tốt. Chuỗi ${stats.streak} ngày.`, href: '/progress' };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif-display text-3xl text-ink mb-1">{greeting}</h1>
        <p className="text-sm text-ink-soft">Hôm nay luyện tiếng Anh cho công việc của bạn.</p>
      </div>

      {!hasNotebook ? (
        <div className="space-y-3">
          <p className="text-sm text-ink-soft leading-relaxed">
            Sổ tay của bạn còn trống. Làm bài kiểm tra trình độ 2 phút để có ngay vài từ đúng sức học, hoặc dán một
            tài liệu công việc để Gemini tìm từ đáng học riêng cho bạn.
          </p>
          <Link href="/placement">
            <Button variant="primary" className="w-full">
              Kiểm tra trình độ (2 phút)
            </Button>
          </Link>
          <Link href="/learn">
            <Button variant="quiet" className="w-full">
              Học từ tài liệu của bạn
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          <span className="font-mono-utility text-xs uppercase tracking-wider text-ink-soft block pb-2 border-b border-rule">
            Hôm nay
          </span>

          {hasWorkToday ? (
            <>
              <div className="space-y-1.5">
                {plan.dueCount > 0 && <PlanRow label="từ đến hạn ôn" value={plan.dueCount} />}
                {plan.freshCount > 0 && <PlanRow label="từ mới chưa học" value={plan.freshCount} />}
                {plan.leechCount > 0 && <PlanRow label="từ bạn hay quên" value={plan.leechCount} />}
              </div>
              <p className="font-mono-utility text-xs text-ink-soft pt-1">
                Khoảng {estimatedMinutes} phút · {practiceCount} thẻ trong buổi này
              </p>
              <Link href="/practice">
                <Button variant="primary" className="w-full">
                  Bắt đầu luyện tập hôm nay
                </Button>
              </Link>
            </>
          ) : (
            <div className="space-y-3 py-2">
              <p className="text-sm text-ink-soft">Bạn đã học xong hôm nay. Quay lại vào ngày mai, hoặc thêm tài liệu mới để học tiếp.</p>
              <Link href="/learn">
                <Button variant="primary" className="w-full">
                  Học từ tài liệu của bạn
                </Button>
              </Link>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        <span className="font-mono-utility text-xs uppercase tracking-wider text-ink-soft block">
          Học từ công việc thật
        </span>
        <div className="bg-surface border border-rule rounded-card shadow-card p-5 space-y-4">
          <p className="text-sm text-ink-soft leading-relaxed">
            Dán một email, báo cáo hay tài liệu công việc. Gemini sẽ tìm từ vựng, cụm từ chuyên nghiệp và lỗi ngữ
            pháp đáng học trong đó.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/learn">
              <Button variant="quiet">
                <FileText size={16} />
                Dán văn bản
              </Button>
            </Link>
            <Link href="/learn?mode=file">
              <Button variant="quiet">
                <Upload size={16} />
                Tải tài liệu
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {hasNotebook && (
        <Link
          href={focus.href}
          className="flex items-center justify-between py-3 border-t border-rule text-sm text-ink hover:text-green transition-colors"
        >
          <span>
            <span className="font-mono-utility text-xs uppercase tracking-wider text-ink-soft block mb-1">
              Cần chú ý
            </span>
            {focus.text}
          </span>
          <ChevronRight size={18} className="text-ink-soft shrink-0" />
        </Link>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono-utility text-ink-soft">
        <Link href="/progress" className="hover:text-ink transition-colors">
          Chuỗi {stats.streak} ngày · dài nhất {stats.longestStreak} ngày · Xem tiến độ →
        </Link>
        <Link href="/leaderboard" className="hover:text-ink transition-colors">
          Bảng xếp hạng →
        </Link>
        <Link href="/calendar" className="hover:text-ink transition-colors">
          Kế hoạch học →
        </Link>
      </div>
    </div>
  );
}

function PlanRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-ink-soft">{label}</span>
      <span className="font-mono-utility font-semibold text-ink">{value}</span>
    </div>
  );
}
