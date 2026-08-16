'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSessionStore } from '@/stores/session-store';
import { useTopupStore } from '@/stores/topup-store';
import { useProfile } from '@/hooks/use-profile';
import { useLastGrammarAttempts } from '@/hooks/use-grammar';
import { useT } from '@/hooks/use-i18n';
import { ExerciseFillBlank } from '@/components/ExerciseFillBlank';
import { ExerciseListen } from '@/components/ExerciseListen';
import { ExerciseWrite } from '@/components/ExerciseWrite';
import { ExerciseRecall } from '@/components/ExerciseRecall';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { CheckCircle2, Sparkles, AlertTriangle, BookCheck, Bookmark } from 'lucide-react';

// Owns the SRS session (moved from app/(tabs)/today/page.tsx — that route is now
// Home V2 and only links here; it no longer auto-starts a session on load). The
// session-store logic itself is unchanged: it already resumes an in-progress
// session on F5 and is route-agnostic, so this is a relocation, not a rewrite
// (docs/decision.md ADR-004 — session.items is frozen for the session's lifetime).
export default function PracticePage() {
  const router = useRouter();
  const { t } = useT();
  const { session, status, error, start, answer, reset } = useSessionStore();
  const ensureSupply = useTopupStore((s) => s.ensureSupply);
  const { stats, settings } = useProfile();
  const lastGrammarAttempts = useLastGrammarAttempts();
  const grammarTopicsAttempted = Object.keys(lastGrammarAttempts).length;

  useEffect(() => {
    // docs/decision.md ADR-018 — top up BEFORE start(): ensureSupply writes real
    // `words` rows if the notebook is running dry, so start()'s dueBefore/
    // newNeverReviewed queries see them. The existing 'building' state below
    // already covers this; top-up just extends how long it shows.
    if (status === 'idle') {
      const now = Date.now();
      void ensureSupply({ now, targetSize: settings.sessionSize }).then(() => start({ now }));
    }
  }, [status, start, ensureSupply, settings.sessionSize]);

  if (status === 'idle' || status === 'building') {
    return (
      <div
        className="py-16 text-center text-sm text-ink-soft font-mono-utility animate-pulse"
        aria-live="polite"
      >
        {t('practice.preparingSession')}
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="py-16 text-center space-y-4" role="alert">
        <AlertTriangle size={32} className="mx-auto text-wrong" />
        <div className="text-sm text-wrong">
          {t('practice.loadError')}
          {error ? <span className="block text-xs text-ink-soft mt-1 font-mono-utility">{error}</span> : null}
        </div>
        {/* Previously terminal until a hard reload — reset() returns status to
            'idle', which re-fires the effect above and retries start(). */}
        <Button variant="primary" onClick={() => reset()}>
          {t('practice.retry')}
        </Button>
      </div>
    );
  }

  if (!session || session.items.length === 0) {
    return (
      <div className="py-8 space-y-6">
        <EmptyState
          icon={<CheckCircle2 size={32} className="text-green" />}
          title={t('practice.doneTitle')}
          description={t('practice.doneDescription')}
          actionLabel={t('practice.doneActionLabel')}
          onAction={() => router.push('/learn')}
        />
        <PracticeExtras grammarTopicsAttempted={grammarTopicsAttempted} />
      </div>
    );
  }

  if (session.status === 'done') {
    return (
      <div className="space-y-6">
        <div className="py-12 px-4 text-center max-w-md mx-auto bg-surface border border-rule rounded-card">
          <div className="w-16 h-16 rounded-full bg-green-wash text-green flex items-center justify-center mx-auto mb-4">
            <Sparkles size={32} />
          </div>
          <h2 className="font-serif-display text-3xl sm:text-4xl text-ink mb-2">
            {t('practice.completeTitle', { count: session.items.length })}
          </h2>
          <p className="text-sm text-ink-soft mb-6">
            {t('practice.completeStreakPrefix')}{' '}
            <span className="font-mono-utility font-semibold text-green">
              {t('practice.completeStreakValue', { streak: stats.streak })}
            </span>
          </p>
          <div className="flex gap-2 justify-center">
            <Button variant="quiet" onClick={() => router.push('/vocabulary')}>
              {t('practice.viewNotebook')}
            </Button>
            <Button variant="primary" onClick={() => router.push('/learn')}>
              {t('practice.learnMore')}
            </Button>
          </div>
        </div>
        <PracticeExtras grammarTopicsAttempted={grammarTopicsAttempted} />
      </div>
    );
  }

  const item = session.items[session.index];
  if (!item) return null;
  const word = item.snapshot;

  return (
    <div className="space-y-6">
      <div className="bg-green rounded-card p-6 sm:p-8 text-paper">
        <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3 inline-block">
          {t('practice.sessionBadge')}
        </span>
        <h1 className="font-serif-display text-2xl sm:text-3xl mb-2">{t('practice.sessionTitle')}</h1>
        <p className="text-paper/80 text-sm sm:text-base max-w-md">
          {t('practice.sessionDescription', { count: session.items.length })}
        </p>
      </div>

      <div
        className="flex items-center justify-center gap-1.5"
        role="progressbar"
        aria-label={t('practice.progressAria')}
        aria-valuenow={session.index + 1}
        aria-valuemin={1}
        aria-valuemax={session.items.length}
      >
        {session.items.map((it, idx) => (
          <span
            key={it.wordId}
            className={`w-2 h-2 rounded-full ${
              idx < session.index ? 'bg-green' : idx === session.index ? 'bg-green ring-2 ring-green/30' : 'bg-rule'
            }`}
          />
        ))}
      </div>
      <p className="font-mono-utility text-xs text-ink-soft text-center -mt-4">
        {session.index + 1} / {session.items.length}
      </p>

      {/* key={item.wordId} forces a full remount on every word change — without
          it, two consecutive items of the same kind (e.g. two 'write' exercises
          in a row) reuse the same component instance, and its local state
          (typed answer, selected option, grading result...) carries over from
          the previous word instead of resetting. */}
      {item.kind === 'fillBlank' && <ExerciseFillBlank key={item.wordId} word={word} onAnswer={answer} />}
      {item.kind === 'listen' && <ExerciseListen key={item.wordId} word={word} onAnswer={answer} />}
      {item.kind === 'write' && (
        <ExerciseWrite key={item.wordId} word={word} onAnswer={answer} contextTopic={settings.contextTopic} />
      )}
      {item.kind === 'recall' && <ExerciseRecall key={item.wordId} word={word} onAnswer={answer} />}
    </div>
  );
}

// Secondary practice surfaces (strategy doc §10.3) — Grammar is de-emphasized off
// the tab bar (docs/decision.md ADR-013) but stays a real, working feature with its
// own history (grammarAttempts, ADR-011), reached from here instead.
function PracticeExtras({ grammarTopicsAttempted }: { grammarTopicsAttempted: number }) {
  const { t } = useT();
  return (
    <div className="pt-4 border-t border-rule space-y-1">
      <Link
        href="/grammar"
        className="flex items-center justify-between py-3 text-sm text-ink hover:text-green transition-colors"
      >
        <span className="flex items-center gap-2">
          <BookCheck size={16} className="text-ink-soft" />
          {t('practice.grammarBasics')}
        </span>
        <span className="text-xs font-mono-utility text-ink-soft">
          {grammarTopicsAttempted > 0
            ? t('practice.grammarAttempted', { count: grammarTopicsAttempted })
            : t('practice.grammarStart')}
        </span>
      </Link>
      <Link
        href="/vocabulary"
        className="flex items-center justify-between py-3 text-sm text-ink hover:text-green transition-colors border-t border-rule"
      >
        <span className="flex items-center gap-2">
          <Bookmark size={16} className="text-ink-soft" />
          {t('practice.notebookLabel')}
        </span>
        <span className="text-xs font-mono-utility text-ink-soft">{t('practice.viewAll')}</span>
      </Link>
    </div>
  );
}
