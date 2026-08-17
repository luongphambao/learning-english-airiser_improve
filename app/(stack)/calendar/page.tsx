'use client';

import React, { useMemo } from 'react';
import { useProfile } from '@/hooks/use-profile';
import { useSettingsStore } from '@/stores/settings-store';
import { BackHeader } from '@/components/layout/back-header';
import { useT } from '@/hooks/use-i18n';
import { dayKey, lastNDays } from '@/lib/srs/date';
import { Calendar, Mail, Target } from 'lucide-react';

// Replaces the old mock tutor-booking flow (docs/decision.md ADR-013 — that screen
// faked a Google Meet link with Math.random() and told the user a booking had been
// saved to their calendar, which was never true). Nothing on this screen claims an
// external action succeeded: every value here reads from or writes to the real
// settings store / real review history. Moved off the tab bar into (stack) as part
// of Navigation V2 — reached from Home and Settings instead (docs/decision.md
// ADR-013), URL kept at /calendar so nothing that linked here breaks.
export default function StudyPlanPage() {
  const { settings, stats } = useProfile();
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const { t } = useT();

  const daysStudiedThisWeek = useMemo(() => {
    const today = dayKey(Date.now());
    return lastNDays(today, 7).filter((d) => (stats.history[d] ?? 0) > 0).length;
  }, [stats.history]);

  return (
    <>
      <BackHeader title={t('calendar.title')} />
      <div className="pt-6 space-y-6">
        <div className="pb-2 border-b border-rule">
          <h2 className="font-serif-display text-2xl text-ink">{t('calendar.heading')}</h2>
          <p className="text-sm text-ink-soft mt-1">
            {t('calendar.subtitle')}
          </p>
        </div>

        <div className="p-5 rounded-card bg-surface border border-rule space-y-4">
          <div className="flex items-center gap-2">
            <Target size={20} className="text-green" />
            <h3 className="font-serif-display text-2xl text-ink">{t('calendar.thisWeek')}</h3>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono-utility text-3xl font-semibold text-ink">{daysStudiedThisWeek}</span>
            <span className="text-sm text-ink-soft">{t('calendar.daysStudiedSuffix')}</span>
          </div>
          <div className="flex gap-1.5" role="img" aria-label={t('calendar.weekProgressAria', { count: daysStudiedThisWeek })}>
            {lastNDays(dayKey(Date.now()), 7).map((d) => (
              <div
                key={d}
                className={`h-2 flex-1 rounded-full ${(stats.history[d] ?? 0) > 0 ? 'bg-green' : 'bg-rule'}`}
              />
            ))}
          </div>
          <p className="text-xs text-ink-soft">
            {t('calendar.currentStreakLabel')}{' '}
            <span className="font-mono-utility text-ink">
              {stats.streak} {t('calendar.daysUnit')}
            </span>{' '}
            · {t('calendar.longestStreakLabel')}{' '}
            <span className="font-mono-utility text-ink">
              {stats.longestStreak} {t('calendar.daysUnit')}
            </span>
          </p>
        </div>

        <div className="p-5 rounded-card bg-surface border border-rule space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar size={20} className="text-green" />
              <h3 className="font-serif-display text-2xl text-ink">{t('calendar.preferredStudyTime')}</h3>
            </div>
            <input
              type="time"
              value={settings.studyTime || '08:00'}
              onChange={(e) => updateSettings({ studyTime: e.target.value })}
              className="p-1.5 rounded-btn bg-paper border border-rule font-mono-utility text-xs text-ink"
            />
          </div>
          <p className="text-xs text-ink-soft leading-relaxed">
            {t('calendar.studyTimeBody')}
          </p>
        </div>

        <div className="p-5 rounded-card bg-surface border border-rule space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail size={20} className="text-green" />
              <h3 className="font-serif-display text-2xl text-ink">{t('calendar.reminderEmailHeading')}</h3>
            </div>
            <select
              aria-label={t('calendar.reminderHourLabel')}
              value={settings.reminderHour === null ? 'off' : String(settings.reminderHour)}
              onChange={(e) =>
                updateSettings({
                  reminderHour: e.target.value === 'off' ? null : Number(e.target.value),
                })
              }
              className="p-1.5 rounded-btn bg-paper border border-rule font-mono-utility text-xs text-ink"
            >
              <option value="off">{t('calendar.reminderOff')}</option>
              <option value="7">{t('calendar.reminder7am')}</option>
              <option value="8">{t('calendar.reminder8am')}</option>
              <option value="9">{t('calendar.reminder9am')}</option>
              <option value="20">{t('calendar.reminder8pm')}</option>
            </select>
          </div>
          <p className="text-xs text-ink-soft leading-relaxed">
            {t('calendar.reminderEmailBody')}
          </p>
        </div>
      </div>
    </>
  );
}
