'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSessionStore } from '@/stores/session-store';
import { useTopupStore } from '@/stores/topup-store';
import { useProfile } from '@/hooks/use-profile';
import { useDailyPlan } from '@/hooks/use-daily-plan';
import { useLastGrammarAttempts } from '@/hooks/use-grammar';
import { useT } from '@/hooks/use-i18n';
import { useIsomorphicLayoutEffect } from '@/hooks/use-isomorphic-layout-effect';
import { ExerciseFillBlank } from '@/components/ExerciseFillBlank';
import { ExerciseListen } from '@/components/ExerciseListen';
import { ExerciseWrite } from '@/components/ExerciseWrite';
import { ExerciseRecall } from '@/components/ExerciseRecall';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { CheckCircle2, Sparkles, AlertTriangle, BookCheck, Bookmark, Shuffle, Loader2 } from 'lucide-react';

// Owns the SRS session (moved from app/(tabs)/today/page.tsx — that route is now
// Home V2 and only links here; it no longer auto-starts a session on load). The
// session-store logic itself is unchanged: it already resumes an in-progress
// session on F5 and is route-agnostic, so this is a relocation, not a rewrite
// (docs/decision.md ADR-004 — session.items is frozen for the session's lifetime).
export default function PracticePage() {
  const router = useRouter();
  const { t } = useT();
  const { session, status, mode, error, start, startNext, answer, reset } = useSessionStore();
  const ensureSupply = useTopupStore((s) => s.ensureSupply);
  const { stats, settings } = useProfile();
  const plan = useDailyPlan();
  const lastGrammarAttempts = useLastGrammarAttempts();
  const grammarTopicsAttempted = Object.keys(lastGrammarAttempts).length;
  const [startingNext, setStartingNext] = useState(false);

  // useSessionStore is a module-level singleton, so a session finished earlier in
  // this page's life is still sitting in `status: 'done'` when the tab is
  // re-entered — and the effect below only builds a session from 'idle'. Without
  // this, coming back to Practice after learning new words re-showed the OLD
  // completion screen until a hard reload (which DID build a new session, since
  // loadActiveSession only ever resumes an 'active' one — the two paths
  // disagreed). Runs before paint so the stale screen never flashes.
  useIsomorphicLayoutEffect(() => {
    if (useSessionStore.getState().status === 'done') useSessionStore.getState().reset();
  }, []);

  async function handleStartNext(nextMode: 'scheduled' | 'review') {
    if (startingNext) return;
    setStartingNext(true);
    const now = Date.now();
    // Same order as the mount effect: top up first so a scheduled round can see
    // any word the corpus supply just wrote.
    if (nextMode === 'scheduled') await ensureSupply({ now, targetSize: settings.sessionSize });
    await startNext({ now: Date.now(), mode: nextMode });
    setStartingNext(false);
  }

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

  // How much real work is left AFTER whatever just happened — a live Dexie query,
  // so answering the last card of a session already moved these numbers before
  // this renders. This is what decides between "học tiếp" and "hết từ rồi".
  const remaining = plan.dueCount + plan.freshCount;

  if (!session || session.items.length === 0) {
    return (
      <div className="py-8 space-y-6">
        <EmptyState
          icon={<CheckCircle2 size={32} className="text-green" />}
          title={t('practice.doneTitle')}
          description={t('practice.doneDescription')}
        />
        <NextStepActions
          remaining={remaining}
          canReview={plan.totalWords > 0}
          busy={startingNext}
          onContinue={() => handleStartNext('scheduled')}
          onReview={() => handleStartNext('review')}
          onLearnNew={() => router.push('/learn')}
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
            {mode === 'review'
              ? t('practice.completeReviewTitle', { count: session.items.length })
              : t('practice.completeTitle', { count: session.items.length })}
          </h2>
          <p className="text-sm text-ink-soft mb-6">
            {t('practice.completeStreakPrefix')}{' '}
            <span className="font-mono-utility font-semibold text-green">
              {t('practice.completeStreakValue', { streak: stats.streak })}
            </span>
          </p>
          <NextStepActions
            remaining={remaining}
            canReview={plan.totalWords > 0}
            busy={startingNext}
            onContinue={() => handleStartNext('scheduled')}
            onReview={() => handleStartNext('review')}
            onLearnNew={() => router.push('/learn')}
            onNotebook={() => router.push('/vocabulary')}
          />
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

/**
 * What to do after a session ends — the answer used to be "leave this screen"
 * (the only buttons went to /learn or /vocabulary), so a user with 30 words still
 * due had to navigate away and back to get a second round.
 *
 * - Words still due or still new  -> keep going, same scheduled session builder.
 * - Nothing left, notebook non-empty -> say so, then offer a free-review round
 *   (random words, ignores the schedule) or learning new material.
 * - Empty notebook -> only learning new material makes sense.
 */
function NextStepActions({
  remaining,
  canReview,
  busy,
  onContinue,
  onReview,
  onLearnNew,
  onNotebook,
}: {
  remaining: number;
  canReview: boolean;
  busy: boolean;
  onContinue: () => void;
  onReview: () => void;
  onLearnNew: () => void;
  onNotebook?: () => void;
}) {
  const { t } = useT();

  if (remaining > 0) {
    return (
      <div className="space-y-3">
        <Button variant="primary" onClick={onContinue} disabled={busy} className="w-full">
          {busy ? <Loader2 size={16} className="animate-spin" /> : null}
          {t('practice.continueCta', { count: remaining })}
        </Button>
        <div className="flex gap-2 justify-center">
          {onNotebook && (
            <Button variant="quiet" onClick={onNotebook}>
              {t('practice.viewNotebook')}
            </Button>
          )}
          <Button variant="quiet" onClick={onLearnNew}>
            {t('practice.learnMore')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-soft">
        {canReview ? t('practice.allCaughtUp') : t('practice.emptyNotebookPrompt')}
      </p>
      {canReview && (
        <Button variant="primary" onClick={onReview} disabled={busy} className="w-full">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Shuffle size={16} />}
          {t('practice.reviewRandomCta')}
        </Button>
      )}
      <Button variant={canReview ? 'quiet' : 'primary'} onClick={onLearnNew} className="w-full">
        {t('practice.learnNewCta')}
      </Button>
      {onNotebook && (
        <div className="flex justify-center">
          <Button variant="quiet" onClick={onNotebook}>
            {t('practice.viewNotebook')}
          </Button>
        </div>
      )}
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
