'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { BackHeader } from '@/components/layout/back-header';
import { Button } from '@/components/Button';
import { TriageList, type TriageListItem } from '@/components/TriageList';
import { loadBand } from '@/lib/corpus/load';
import type { CorpusEntry } from '@/lib/corpus/types';
import { buildPlacementItems, scorePlacement, type PlacementItem } from '@/lib/level/placement';
import { cefrIndex } from '@/lib/level/cefr';
import { useLevelStore } from '@/stores/level-store';
import { getRepos } from '@/lib/repositories';
import type { Cefr, KnownState } from '@/lib/domain';
import { useT } from '@/hooks/use-i18n';

const BANDS: Cefr[] = ['A2', 'B1', 'B2', 'C1', 'C2'];
const MAX_TRIAGE_CANDIDATES = 8;

// docs/decision.md ADR-017 — this is spec §8.3 finally built: a 20-word yes/no
// vocabulary check (screen 1), scored purely from the corpus (no AI call — the
// whole point is it works offline and for a brand-new user with an empty
// notebook), then the spec's CEFR-driven 3-level triage (screen 2) on the words the
// user marked unknown at or above their computed level.
export default function PlacementPage() {
  const { t } = useT();
  const recordPlacement = useLevelStore((s) => s.recordPlacement);

  const [phase, setPhase] = useState<'loading' | 'test' | 'triage' | 'done'>('loading');
  const [items, setItems] = useState<PlacementItem[]>([]);
  const [known, setKnown] = useState<Record<string, boolean>>({});
  const [level, setLevel] = useState<Cefr>('B2');
  const [candidates, setCandidates] = useState<TriageListItem[]>([]);
  const [addedCount, setAddedCount] = useState(0);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries: Partial<Record<Cefr, CorpusEntry[]>> = {};
      await Promise.all(
        BANDS.map(async (band) => {
          entries[band] = await loadBand(band);
        }),
      );
      if (cancelled) return;
      setItems(buildPlacementItems(entries, 4));
      setPhase('test');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function toggle(word: string) {
    setKnown((k) => ({ ...k, [word]: !k[word] }));
  }

  async function submitTest() {
    const now = Date.now();
    const score = scorePlacement(items.map((item) => ({ cefr: item.cefr, known: known[item.word] ?? false })));
    await recordPlacement(score, now);
    setLevel(score.level);

    const unknownAtLevel = items
      .filter((item) => !known[item.word] && cefrIndex(item.cefr) >= cefrIndex(score.level))
      .slice(0, MAX_TRIAGE_CANDIDATES)
      .map((item): TriageListItem => ({ id: item.word, word: item.word, vi: item.vi, cefr: item.cefr }));

    if (unknownAtLevel.length === 0) {
      setPhase('done');
      return;
    }
    setCandidates(unknownAtLevel);
    setPhase('triage');
  }

  async function confirmTriage(choices: Record<string, KnownState>) {
    setConfirming(true);
    const now = Date.now();
    const repos = getRepos();
    let added = 0;
    for (const item of candidates) {
      const choice = choices[item.id] ?? 'known';
      if (choice === 'known') {
        await repos.skipped.add(item.word, now);
        continue;
      }
      await repos.words.addFromCorpus({
        word: item.word,
        meaningVi: item.vi,
        exampleSentence: '',
        distractors: [],
        cefr: item.cefr ?? level,
        source: { kind: 'session', label: 'Bài kiểm tra trình độ', at: now },
        triage: choice,
        now,
      });
      added += 1;
    }
    setAddedCount(added);
    setConfirming(false);
    setPhase('done');
  }

  const answeredCount = Object.values(known).filter(Boolean).length;

  return (
    <>
      <BackHeader title={t('placement.title')} />
      <div className="pt-6 max-w-md mx-auto pb-12">
        {phase === 'loading' && (
          <div className="py-20 text-center">
            <Loader2 size={32} className="mx-auto text-green animate-spin" />
          </div>
        )}

        {phase === 'test' && (
          <div className="space-y-5">
            <div>
              <h1 className="font-serif-display text-2xl text-ink mb-1">{t('placement.test.heading')}</h1>
              <p className="text-sm text-ink-soft">{t('placement.test.subtitle')}</p>
            </div>
            <div className="space-y-2">
              {items.map((item) => (
                <label
                  key={item.word}
                  className={`flex items-center gap-3 p-3.5 rounded-card border cursor-pointer transition-all ${
                    known[item.word] ? 'border-green bg-green-wash' : 'border-rule bg-surface'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={known[item.word] ?? false}
                    onChange={() => toggle(item.word)}
                    className="accent-green"
                  />
                  <span lang="en" className="font-serif-display text-lg text-ink">
                    {item.word}
                  </span>
                </label>
              ))}
            </div>
            <Button variant="primary" onClick={submitTest} className="w-full">
              {t('placement.test.resultsCta', { answered: answeredCount, total: items.length })}
            </Button>
            <Link href="/today" className="block text-center text-xs text-ink-soft hover:text-ink transition-colors">
              {t('placement.test.skipCta')}
            </Link>
          </div>
        )}

        {phase === 'triage' && (
          <div className="space-y-5">
            <div>
              <h1 className="font-serif-display text-2xl text-ink mb-1">{t('placement.triage.heading')}</h1>
              <p className="text-sm text-ink-soft">
                {t('placement.triage.subtitlePrefix')} <strong className="text-ink">{level}</strong>.{' '}
                {t('placement.triage.subtitleSuffix')}
              </p>
            </div>
            <TriageList
              items={candidates}
              onConfirm={confirmTriage}
              confirming={confirming}
              confirmLabel="Bắt đầu học"
            />
          </div>
        )}

        {phase === 'done' && (
          <div className="py-16 text-center space-y-4">
            <CheckCircle2 size={48} className="mx-auto text-green" />
            <p className="font-serif-display text-2xl text-ink">{t('placement.done.resultLabel', { level })}</p>
            <p className="text-sm text-ink-soft">
              {addedCount > 0
                ? t('placement.done.addedWords', { count: addedCount })
                : t('placement.done.readyNotebook')}
            </p>
            <div className="flex flex-wrap gap-2 justify-center pt-2">
              <Link href="/today">
                <Button variant="quiet">{t('placement.done.homeCta')}</Button>
              </Link>
              <Link href="/practice">
                <Button variant="primary">{t('placement.done.practiceCta')}</Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
