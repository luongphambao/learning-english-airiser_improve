'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useProfile } from '@/hooks/use-profile';
import { useWordsList } from '@/hooks/use-words';
import { useLeaderboard, LEADERBOARD_FETCH_LIMIT } from '@/hooks/use-leaderboard';
import { useT } from '@/hooks/use-i18n';
import { getFirebaseAuth } from '@/lib/firebase/client';
import { BackHeader } from '@/components/layout/back-header';
import { Button } from '@/components/Button';
import { MetricChips } from '@/components/leaderboard/metric-chips';
import { Podium } from '@/components/leaderboard/podium';
import { RankRow } from '@/components/leaderboard/rank-row';
import { buildLeaderboard, buildMyEntry, getMetric } from '@/lib/leaderboard/metrics';
import { resolveDisplayName } from '@/lib/leaderboard/name';
import type { LeaderboardEntry, LeaderboardMetricId } from '@/lib/leaderboard/types';

function secondaryLine(entry: LeaderboardEntry, t: (key: string, vars?: Record<string, string | number>) => string): string {
  const accuracy = entry.totalReviews > 0 ? Math.round((entry.totalCorrect / entry.totalReviews) * 100) : 0;
  return t('leaderboardPage.rowSecondary', { reviews: entry.totalReviews, accuracy });
}

interface Identity {
  uid: string | null;
  displayName: string | null | undefined;
}

export default function LeaderboardPage() {
  const { stats, settings } = useProfile();
  const { t } = useT();
  // Default useWordsList limit (500) would silently undercount a very large
  // notebook — here the count itself is the point, unlike /progress which only
  // ever renders a bounded list.
  const words = useWordsList({ limit: 2000 });
  const [metric, setMetric] = useState<LeaderboardMetricId>('words');
  const [now, setNow] = useState<number | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const myRowRef = useRef<HTMLLIElement | null>(null);
  const { status: remoteStatus, entries: remoteEntries, reload } = useLeaderboard();

  useEffect(() => {
    setNow(Date.now());
    // Read once on mount, not reactively: app/providers.tsx remounts this whole
    // subtree (key={uid}) on every sign-in/out/account-switch, so `identity`
    // never needs to change out from under an already-mounted page.
    const authUser = getFirebaseAuth().currentUser;
    setIdentity({ uid: authUser?.uid ?? null, displayName: authUser?.displayName });
  }, []);

  const name = identity
    ? resolveDisplayName(
        { nickname: settings.leaderboardName, displayName: identity.displayName },
        t('leaderboardPage.anonymousName'),
      )
    : '';
  const me = useMemo(
    () => (now === null || identity === null ? null : buildMyEntry(stats, settings, words, now, { uid: identity.uid, name })),
    [stats, settings, words, now, identity, name],
  );

  const signedOut = identity !== null && identity.uid === null;
  // Signed-out users never fetch the shared board (nothing would resolve to
  // their own doc anyway) — they only ever see their own local row. Signed-in
  // users wait for the fetch; a failed fetch degrades to "just your own row"
  // rather than blocking the whole screen, with an inline retry.
  const others = signedOut ? [] : remoteStatus === 'ready' ? remoteEntries : [];
  const loading = me === null || (!signedOut && remoteStatus === 'loading');
  const ranked = me === null ? null : buildLeaderboard(me, others, metric);

  const activeMetric = getMetric(metric);
  const formatValue = (entry: LeaderboardEntry) => activeMetric.format(entry, t);
  const hasData = me !== null && (me.words > 0 || me.totalReviews > 0);
  const myRanked = ranked?.find((r) => r.entry.isMe) ?? null;
  const nearCap = !signedOut && remoteStatus === 'ready' && remoteEntries.length >= LEADERBOARD_FETCH_LIMIT;

  return (
    <>
      <BackHeader title={t('leaderboardPage.backHeaderTitle')} />
      <div className="space-y-6 animate-fade-in pt-6 pb-24">
        <MetricChips value={metric} onChange={setMetric} />

        {signedOut && (
          <div className="space-y-2 bg-surface border border-rule rounded-card p-4">
            <p className="text-sm text-ink">
              <span className="font-semibold">{t('leaderboardPage.signedOutTitle')}</span>{' '}
              {t('leaderboardPage.signedOutBody')}
            </p>
            <Link href="/login">
              <Button variant="primary" className="w-full">
                {t('leaderboardPage.signedOutCta')}
              </Button>
            </Link>
          </div>
        )}

        {!signedOut && remoteStatus === 'error' && (
          <div className="flex items-center justify-between gap-3 bg-surface border border-rule rounded-card p-4">
            <p className="text-sm text-ink-soft">{t('leaderboardPage.loadError')}</p>
            <Button variant="quiet" type="button" onClick={reload}>
              {t('leaderboardPage.retryCta')}
            </Button>
          </div>
        )}

        {loading ? (
          <ul className="space-y-2" aria-hidden="true">
            <span className="sr-only">{t('leaderboardPage.loadingLabel')}</span>
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="h-14 rounded-card border border-rule bg-surface" />
            ))}
          </ul>
        ) : (
          ranked && (
            <>
              <Podium top3={ranked.slice(0, 3)} format={formatValue} />

              <ul className="bg-surface border border-rule rounded-card divide-y divide-rule overflow-hidden">
                {ranked.map((r) => (
                  <RankRow
                    key={r.entry.id}
                    ref={r.entry.isMe ? myRowRef : undefined}
                    ranked={r}
                    format={formatValue}
                    secondary={(entry) => secondaryLine(entry, t)}
                    showDash={!r.qualified || (r.entry.isMe && !hasData)}
                    nameOverride={r.entry.isMe && !hasData ? t('leaderboardPage.meNewcomer') : undefined}
                  />
                ))}
              </ul>

              {nearCap && <p className="text-center text-[11px] text-ink-soft">{t('leaderboardPage.capNotice')}</p>}
            </>
          )
        )}
      </div>

      <div className="sticky bottom-0 z-30 -mx-4 border-t border-rule bg-paper/95 px-4 pt-3 pb-safe backdrop-blur-sm sm:mx-0 sm:rounded-card sm:border sm:px-4 sm:pb-3">
        {ranked === null ? null : hasData && myRanked ? (
          <div className="flex items-center justify-between gap-3 pb-3">
            <div>
              <span className="block text-[11px] text-ink-soft">{t('leaderboardPage.myRankPosition')}</span>
              <span className="font-mono-utility text-sm font-semibold text-ink">
                #{myRanked.rank} / {ranked.length}
                <span className="ml-2 font-normal text-ink-soft">{formatValue(myRanked.entry)}</span>
              </span>
            </div>
            <Button
              variant="quiet"
              type="button"
              onClick={() => myRowRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })}
            >
              {t('leaderboardPage.viewMyRowCta')}
            </Button>
          </div>
        ) : (
          <div className="space-y-2 pb-3">
            <p className="text-sm text-ink">
              <span className="font-semibold">{t('leaderboardPage.noDataTitle')}</span>{' '}
              {t('leaderboardPage.noDataBody')}
            </p>
            <Link href="/placement">
              <Button variant="primary" className="w-full">
                {t('leaderboardPage.checkLevelCta')}
              </Button>
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
