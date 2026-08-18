'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { BackHeader } from '@/components/layout/back-header';
import { Button } from '@/components/Button';
import { GoalPicker } from '@/components/goal-picker';
import { useProfile, useOnboardingAnswered } from '@/hooks/use-profile';
import { useWordsList } from '@/hooks/use-words';
import { useSettingsStore } from '@/stores/settings-store';
import { useT } from '@/hooks/use-i18n';
import { GOAL_MAX_LENGTH, type GoalKind } from '@/lib/domain';

// docs/decision.md ADR-028 — the first screen after signing in (or after tapping
// "dùng thử"), asking the two things every AI prompt in the app already interpolates
// but nothing ever collected: what the learner is studying FOR, and what field they
// work in. One screen, two questions, both skippable — the placement test that
// follows is the part that actually seeds a notebook, and this must not stand
// between a new user and it for longer than it takes to type "IELTS 6.5".
export default function OnboardingPage() {
  const router = useRouter();
  const { t } = useT();
  const { settings } = useProfile();
  const answered = useOnboardingAnswered();
  const words = useWordsList({ limit: 1 });
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  const [goal, setGoal] = useState<{ kind: GoalKind; text: string }>({ kind: 'custom', text: '' });
  const [contextTopic, setContextTopic] = useState('');
  const [saving, setSaving] = useState(false);
  // Answering flips `answered` to true, which would otherwise make the
  // forward-returning-learners effect below fire and overwrite the destination
  // finish() picked — sending a brand-new learner to /today instead of the
  // placement test that actually fills their notebook.
  const finishing = useRef(false);

  // Prefilled from whatever is already stored, so reaching this screen a second
  // time (deep link, browser back) shows the real values rather than blanks.
  useEffect(() => {
    setGoal({ kind: settings.learningGoal.kind, text: settings.learningGoal.text });
    setContextTopic(settings.contextTopic);
  }, [settings.learningGoal.kind, settings.learningGoal.text, settings.contextTopic]);

  // Every sign-in routes here (app/(stack)/login/page.tsx), so a returning learner
  // has to be forwarded on. `answered === undefined` means Dexie has not answered
  // yet — waiting is what keeps the form from flashing before the redirect.
  useEffect(() => {
    if (answered === true && !finishing.current) router.replace('/today');
  }, [answered, router]);

  async function finish(withGoal: boolean) {
    finishing.current = true;
    setSaving(true);
    const now = Date.now();
    await updateSettings({
      // `setAt` is written even when skipping: skipping means "stop asking", and
      // the goal stays editable in Settings either way.
      learningGoal: withGoal
        ? { kind: goal.kind, text: goal.text.trim().slice(0, GOAL_MAX_LENGTH), setAt: now }
        : { ...settings.learningGoal, setAt: now },
      ...(withGoal && contextTopic.trim() ? { contextTopic: contextTopic.trim() } : {}),
    });
    // A brand-new notebook goes to the placement test, which is what actually puts
    // words in it — /today would only show the same CTA one tap later.
    router.replace(words.length === 0 ? '/placement' : '/today');
  }

  if (answered !== false) {
    return (
      <>
        <BackHeader title={t('onboarding.title')} />
        <div className="py-20 text-center">
          <Loader2 size={32} className="mx-auto text-green animate-spin" />
        </div>
      </>
    );
  }

  return (
    <>
      <BackHeader title={t('onboarding.title')} />
      <div className="pt-6 max-w-md mx-auto pb-12 space-y-6">
        <div>
          <h1 className="font-serif-display text-2xl text-ink mb-1">{t('onboarding.heading')}</h1>
          <p className="text-sm text-ink-soft">{t('onboarding.subtitle')}</p>
        </div>

        <div className="space-y-2">
          <h2 className="text-xs font-mono-utility text-ink-soft uppercase tracking-wide">
            {t('onboarding.goalLabel')}
          </h2>
          <GoalPicker value={goal} onChange={setGoal} />
        </div>

        <div className="space-y-2">
          <label htmlFor="onboarding-field" className="block text-xs font-mono-utility text-ink-soft uppercase tracking-wide">
            {t('onboarding.fieldLabel')}
          </label>
          <input
            id="onboarding-field"
            type="text"
            value={contextTopic}
            onChange={(e) => setContextTopic(e.target.value)}
            maxLength={80}
            placeholder={t('onboarding.fieldPlaceholder')}
            className="w-full px-3.5 py-2.5 rounded-card border border-rule bg-surface text-sm text-ink focus:outline-none focus:border-green"
          />
          <p className="text-xs text-ink-soft">{t('onboarding.fieldHint')}</p>
        </div>

        <Button variant="primary" onClick={() => finish(true)} disabled={saving} className="w-full">
          {t('onboarding.continueCta')}
        </Button>
        <button
          type="button"
          onClick={() => finish(false)}
          disabled={saving}
          className="block w-full text-center text-xs text-ink-soft hover:text-ink transition-colors cursor-pointer"
        >
          {t('onboarding.skipCta')}
        </button>
      </div>
    </>
  );
}
