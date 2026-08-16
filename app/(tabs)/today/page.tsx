'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useProfile } from '@/hooks/use-profile';
import { useDailyPlan } from '@/hooks/use-daily-plan';
import { useTopupStore } from '@/stores/topup-store';
import { useT } from '@/hooks/use-i18n';
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
  const { t } = useT();
  const [greetingKey, setGreetingKey] = useState('today.greetingHello');

  // new Date().getHours() would mismatch between SSR prerender and hydration if
  // computed at render time — resolve it client-side only, after mount, same
  // pattern as the suppressHydrationWarning clock reads elsewhere (calendar,
  // progress pages).
  useEffect(() => {
    const h = new Date().getHours();
    setGreetingKey(h < 11 ? 'today.greetingMorning' : h < 18 ? 'today.greetingAfternoon' : 'today.greetingEvening');
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
      ? { text: t('today.focusLeech', { count: plan.leechCount }), href: '/practice' }
      : accuracy !== null && stats.totalReviews >= 10 && accuracy < 70
        ? { text: t('today.focusLowAccuracy', { accuracy }), href: '/practice' }
        : plan.totalWords < 10
          ? { text: t('today.focusFewWords'), href: '/learn' }
          : { text: t('today.focusGoodPace', { streak: stats.streak }), href: '/progress' };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif-display text-3xl text-ink mb-1">{t(greetingKey)}</h1>
        <p className="text-sm text-ink-soft">{t('today.subtitle')}</p>
      </div>

      {!hasNotebook ? (
        <div className="space-y-3">
          <p className="text-sm text-ink-soft leading-relaxed">{t('today.emptyNotebook')}</p>
          <Link href="/placement">
            <Button variant="primary" className="w-full">
              {t('today.checkLevelCta')}
            </Button>
          </Link>
          <Link href="/learn">
            <Button variant="quiet" className="w-full">
              {t('today.learnFromDocCta')}
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          <span className="font-mono-utility text-xs uppercase tracking-wider text-ink-soft block pb-2 border-b border-rule">
            {t('today.todayLabel')}
          </span>

          {hasWorkToday ? (
            <>
              <div className="space-y-1.5">
                {plan.dueCount > 0 && <PlanRow label={t('today.dueWords')} value={plan.dueCount} />}
                {plan.freshCount > 0 && <PlanRow label={t('today.newWords')} value={plan.freshCount} />}
                {plan.leechCount > 0 && <PlanRow label={t('today.leechWords')} value={plan.leechCount} />}
              </div>
              <p className="font-mono-utility text-xs text-ink-soft pt-1">
                {t('today.sessionSummary', { minutes: estimatedMinutes, count: practiceCount })}
              </p>
              <Link href="/practice">
                <Button variant="primary" className="w-full">
                  {t('today.startPracticeCta')}
                </Button>
              </Link>
            </>
          ) : (
            <div className="space-y-3 py-2">
              <p className="text-sm text-ink-soft">{t('today.doneToday')}</p>
              <Link href="/learn">
                <Button variant="primary" className="w-full">
                  {t('today.learnFromDocCta')}
                </Button>
              </Link>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        <span className="font-mono-utility text-xs uppercase tracking-wider text-ink-soft block">
          {t('today.learnFromWorkLabel')}
        </span>
        <div className="bg-surface border border-rule rounded-card shadow-card p-5 space-y-4">
          <p className="text-sm text-ink-soft leading-relaxed">{t('today.learnFromWorkBody')}</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/learn">
              <Button variant="quiet">
                <FileText size={16} />
                {t('today.pasteText')}
              </Button>
            </Link>
            <Link href="/learn?mode=file">
              <Button variant="quiet">
                <Upload size={16} />
                {t('today.uploadDoc')}
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
              {t('today.needsAttention')}
            </span>
            {focus.text}
          </span>
          <ChevronRight size={18} className="text-ink-soft shrink-0" />
        </Link>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono-utility text-ink-soft">
        <Link href="/progress" className="hover:text-ink transition-colors">
          {t('today.streakFooter', { streak: stats.streak, longest: stats.longestStreak })}
        </Link>
        <Link href="/leaderboard" className="hover:text-ink transition-colors">
          {t('today.leaderboardFooter')}
        </Link>
        <Link href="/calendar" className="hover:text-ink transition-colors">
          {t('today.studyPlanFooter')}
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
