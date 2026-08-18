'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, AlertTriangle, CheckCircle2, RotateCcw, Sparkles } from 'lucide-react';
import { useT } from '@/hooks/use-i18n';
import { useProfile } from '@/hooks/use-profile';
import { Button } from '@/components/Button';
import { TriageList, type TriageListItem } from '@/components/TriageList';
import { useTopicStore } from '@/stores/topic-store';
import { goalForPrompt, type KnownState } from '@/lib/domain';
import { resolveErrorMessage } from '@/lib/i18n/api-error';

// docs/decision.md ADR-028 — "Học từ mới theo chủ đề", the third tab on /learn.
// Presentational only: the AI call and every Dexie write live in
// stores/topic-store.ts (docs/architecture.md §1).

const TOPIC_MAX_LENGTH = 120;

/** Starting points, not a menu — the input stays free text. They exist because a
 * blank box asking for "a topic" gets abandoned, while a tapped example gets
 * edited. */
const EXAMPLE_KEYS = ['environment', 'technology', 'health', 'travel', 'business'] as const;

export function TopicSuggest() {
  const { t } = useT();
  const { settings } = useProfile();
  const { status, candidates, savedResult, errorKey, topic, suggest, saveTriage, reset } = useTopicStore();
  const [draft, setDraft] = useState('');

  async function handleSuggest() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    await suggest({
      topic: trimmed,
      level: settings.level,
      contextTopic: settings.contextTopic,
      goal: goalForPrompt(settings.learningGoal),
    });
  }

  function startOver() {
    reset();
    setDraft('');
  }

  if (status === 'suggesting') {
    return (
      <div className="py-20 text-center space-y-4">
        <Loader2 size={40} className="mx-auto text-green animate-spin" />
        <p className="font-serif-display text-2xl text-ink">{t('learnTopic.loading.heading')}</p>
        <p className="text-sm text-ink-soft">{t('learnTopic.loading.body', { topic })}</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="py-20 text-center space-y-4">
        <AlertTriangle size={48} className="mx-auto text-wrong" />
        <p className="font-serif-display text-2xl text-ink">{t('learnTopic.error.heading')}</p>
        <p className="text-sm text-ink-soft max-w-sm mx-auto">
          {resolveErrorMessage(errorKey, t, t('learnTopic.error.fallback'))}
        </p>
        <Button variant="primary" onClick={startOver}>
          {t('learnTopic.error.retry')}
        </Button>
      </div>
    );
  }

  if (savedResult) {
    return (
      <div className="py-20 text-center space-y-4">
        <CheckCircle2 size={48} className="mx-auto text-green" />
        <p className="font-serif-display text-2xl text-ink">
          {t('learnTopic.success.heading', { count: savedResult.added })}
        </p>
        <p className="text-sm text-ink-soft">
          {savedResult.skipped > 0
            ? t('learnTopic.success.skippedNote', { count: savedResult.skipped })
            : t('learnTopic.success.readyNote')}
        </p>
        <div className="flex flex-wrap gap-2 justify-center pt-2">
          <Button variant="quiet" onClick={startOver}>
            <RotateCcw size={16} />
            {t('learnTopic.success.startOver')}
          </Button>
          <Link href="/practice">
            <Button variant="primary">{t('learnTopic.success.practiceNow')}</Button>
          </Link>
        </div>
      </div>
    );
  }

  if ((status === 'ready' || status === 'saving') && candidates.length > 0) {
    const items: TriageListItem[] = candidates.map((c) => ({
      id: c.word,
      word: c.word,
      vi: c.meaningVi,
      cefr: c.cefr,
      note: c.exampleSentence || undefined,
    }));

    return (
      <div className="space-y-5 pb-24">
        <div>
          <button
            type="button"
            onClick={startOver}
            className="flex items-center gap-1.5 text-xs text-ink-soft hover:text-green transition-colors mb-3 cursor-pointer"
          >
            <RotateCcw size={13} />
            {t('learnTopic.result.startOver')}
          </button>
          <h1 className="font-serif-display text-3xl text-ink mb-2">{t('learnTopic.result.title', { topic })}</h1>
          <p className="text-sm text-ink-soft">{t('learnTopic.result.subtitle', { count: candidates.length })}</p>
        </div>
        <TriageList
          items={items}
          onConfirm={(choices: Record<string, KnownState>) => void saveTriage(choices, Date.now())}
          confirming={status === 'saving'}
          confirmLabel={t('learnTopic.result.confirmLabel')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif-display text-2xl text-ink mb-1">{t('learnTopic.heading')}</h1>
        <p className="text-sm text-ink-soft">{t('learnTopic.subtitle')}</p>
      </div>

      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void handleSuggest();
        }}
        maxLength={TOPIC_MAX_LENGTH}
        placeholder={t('learnTopic.placeholder')}
        aria-label={t('learnTopic.inputAria')}
        className="w-full px-3.5 py-3 rounded-card border border-rule bg-surface text-sm text-ink focus:outline-none focus:border-green"
      />

      <div className="flex flex-wrap gap-2">
        {EXAMPLE_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setDraft(t(`learnTopic.examples.${key}`))}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-rule bg-paper text-ink-soft hover:text-ink transition-all cursor-pointer"
          >
            {t(`learnTopic.examples.${key}`)}
          </button>
        ))}
      </div>

      <Button variant="primary" onClick={handleSuggest} disabled={!draft.trim()} className="w-full">
        <Sparkles size={16} />
        {t('learnTopic.suggestCta')}
      </Button>

      {settings.learningGoal.text && (
        <p className="text-xs text-ink-soft text-center">
          {t('learnTopic.goalNotice', { goal: settings.learningGoal.text })}
        </p>
      )}
    </div>
  );
}
