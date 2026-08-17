'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useProfile } from '@/hooks/use-profile';
import { useDailyPlan } from '@/hooks/use-daily-plan';
import { useTopupStore } from '@/stores/topup-store';
import { useT } from '@/hooks/use-i18n';
import { Button } from '@/components/Button';
import { FileText, Upload, ChevronRight, Flame, Trophy, CalendarDays } from 'lucide-react';

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
    // Mobile: a plain flex column — DOM order IS visual order (greeting, streak,
    // today's plan, learn-from-work, focus), unchanged from before this layout
    // existed. lg and up: the same blocks placed explicitly into two columns, so the
    // desktop rearrangement costs nothing on phones and needs no DOM reordering
    // (which would also reorder the tab sequence for keyboard users). Explicit
    // col-start/row-start rather than auto-placement — auto-placement fills
    // row-by-row and would split the rail's cards across both columns.
    <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-x-8 lg:items-start">
      <div className="lg:col-span-2">
        <h1 className="font-serif-display text-3xl lg:text-4xl text-ink mb-1">{t(greetingKey)}</h1>
        <p className="text-sm text-ink-soft">{t('today.subtitle')}</p>
      </div>

      {/* Streak is the motivation hook, so it leads the page as a full card instead of
          the row of tiny mono links this used to be; the two destinations under it are
          pure navigation and stay visually secondary. Gated on hasNotebook so a
          brand-new user meets the placement CTA first, not a "0 ngày" card.
          At lg it becomes the top of the right-hand rail. */}
      {hasNotebook && (
        <div className="space-y-3 lg:col-start-2 lg:row-start-2">
          <Link
            href="/progress"
            className="flex items-center gap-4 bg-surface border border-rule rounded-card shadow-card p-5 hover:border-green transition-colors"
          >
            <div className="w-12 h-12 rounded-full bg-amber/10 grid place-items-center shrink-0">
              <Flame size={22} className="fill-amber text-amber" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono-utility text-3xl font-bold text-amber-ink leading-none">
                  {stats.streak}
                </span>
                <span className="text-sm text-ink-soft">{t('today.streakHeroLabel')}</span>
              </div>
              <span className="text-xs text-ink-soft block mt-1">
                {t('today.streakHeroLongest', { days: stats.longestStreak })}
              </span>
            </div>
            <ChevronRight size={18} className="text-ink-soft shrink-0" />
          </Link>

          {/* Two across on mobile (full content width, ~150px each is plenty); one
              per row inside the lg rail, where two would leave "Bảng xếp hạng"
              wrapping onto a second line and pushing its chevron out of alignment. */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <NavTile
              href="/leaderboard"
              label={t('today.leaderboardTile')}
              icon={<Trophy size={18} className="text-amber" />}
              iconClass="bg-amber/10"
            />
            <NavTile
              href="/calendar"
              label={t('today.studyPlanTile')}
              icon={<CalendarDays size={18} className="text-green" />}
              iconClass="bg-green-wash"
            />
          </div>
        </div>
      )}

      {/* Left column at lg: today's plan (the primary action) above learn-from-work.
          One wrapper rather than two grid items, so the two never get pulled apart by
          the rail's row height. With an empty notebook there IS no rail (streak and
          focus both render only when hasNotebook), so the onboarding CTA spans the
          full grid instead of leaving a dead half — capped at 2xl so it stays a
          readable column rather than a 1024px-wide button. */}
      <div
        className={`flex flex-col gap-8 ${
          hasNotebook ? 'lg:col-start-1 lg:row-start-2 lg:row-span-2' : 'lg:col-span-2 lg:max-w-2xl'
        }`}
      >
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
      </div>

      {hasNotebook && (
        <Link
          href={focus.href}
          className="flex items-center justify-between py-3 border-t border-rule text-sm text-ink hover:text-green transition-colors lg:col-start-2 lg:row-start-3 lg:self-start"
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

    </div>
  );
}

function NavTile({
  href,
  label,
  icon,
  iconClass,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  iconClass: string;
}) {
  return (
    // Stacked (icon over label) in the two-across mobile grid; a single row at lg,
    // where the tile spans the whole rail and matches the streak card above it
    // instead of sitting as a tall block of mostly empty card.
    <Link
      href={href}
      className="flex flex-col gap-3 lg:flex-row lg:items-center bg-surface border border-rule rounded-card shadow-card p-4 hover:border-green transition-colors"
    >
      <div className={`w-9 h-9 rounded-full grid place-items-center shrink-0 ${iconClass}`}>{icon}</div>
      <div className="flex items-center justify-between gap-2 lg:flex-1 lg:min-w-0">
        <span className="text-sm font-semibold text-ink">{label}</span>
        <ChevronRight size={16} className="text-ink-soft shrink-0" />
      </div>
    </Link>
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
