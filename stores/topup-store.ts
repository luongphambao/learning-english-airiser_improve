import { create } from 'zustand';
import { getRepos } from '@/lib/repositories';
import { callTask } from '@/lib/api/ai-client';
import { loadBand } from '@/lib/corpus/load';
import { buildExclusionSet } from '@/lib/corpus/exclude';
import { pickCorpusWords } from '@/lib/corpus/pick';
import { stepCefr } from '@/lib/level/cefr';
import { dayKey } from '@/lib/srs/date';
import type { Cefr } from '@/lib/domain';
import type { CorpusEntry } from '@/lib/corpus/types';

// docs/decision.md ADR-018 — writes real `words` rows (not a parallel "suggestion"
// buffer), so useLiveQuery re-fires and Home/practice counts can never drift from
// what actually got added. This is the single source of "a session is never empty".

interface TopupResult {
  added: number;
  degraded: boolean;
}

interface TopupStoreState {
  ensureSupply(opts: { now: number; targetSize: number }): Promise<TopupResult>;
}

const MIN_INTERVAL_MS = 60_000;
const DAILY_CAP = 20;
const ENRICH_TIMEOUT_MS = 15_000;
const MAX_BATCH = 8; // enrichWordBatch's own input cap

const LAST_RUN_KEY = 'topup:lastRunAt';
const addedTodayKey = (now: number) => `topup:addedOn:${dayKey(now)}`;

// Module-level in-flight guard: ensureSupply can be called from both /practice and
// /today around the same moment (a page mount racing a fire-and-forget Home
// prefetch) — without this, two concurrent runs could each read the same deficit
// and double-write.
let inFlight: Promise<TopupResult> | null = null;

async function run(now: number, targetSize: number): Promise<TopupResult> {
  const repos = getRepos();

  const due = await repos.words.dueBefore(now, targetSize);
  const fresh = await repos.words.newNeverReviewed(targetSize, due.map((w) => w.id));
  const deficit = targetSize - (due.length + fresh.length);
  if (deficit <= 0) return { added: 0, degraded: false };

  const lastRunAt = await repos.meta.get<number>(LAST_RUN_KEY);
  if (lastRunAt !== undefined && now - lastRunAt < MIN_INTERVAL_MS) {
    return { added: 0, degraded: false };
  }

  const addedTodayCount = (await repos.meta.get<number>(addedTodayKey(now))) ?? 0;
  const dailyRemaining = DAILY_CAP - addedTodayCount;
  if (dailyRemaining <= 0) return { added: 0, degraded: false };

  await repos.meta.put(LAST_RUN_KEY, now);

  const { settings } = await repos.user.getProfile();
  const level = settings.level;
  const nextLevel = stepCefr(level, 1);

  const [exclude, atLevel, atNext] = await Promise.all([
    buildExclusionSet(),
    loadBand(level),
    nextLevel !== level ? loadBand(nextLevel) : Promise.resolve<CorpusEntry[]>([]),
  ]);

  const count = Math.min(deficit, dailyRemaining, MAX_BATCH);
  // level and nextLevel coincide only at the C2 ceiling (stepCefr clamps there) —
  // guard the key collision explicitly rather than let a later assignment silently
  // overwrite the first with an empty array.
  const entries: Partial<Record<Cefr, CorpusEntry[]>> =
    nextLevel === level ? { [level]: atLevel } : { [level]: atLevel, [nextLevel]: atNext };
  const picked = pickCorpusWords({ entries, level, exclude, count });
  if (picked.length === 0) return { added: 0, degraded: false };

  let enrichedByWord = new Map<string, { ipa: string; partOfSpeech: string; meaningVi: string; exampleSentence: string; distractors: string[] }>();
  let degraded = false;

  try {
    const result = await callTask(
      'enrichWordBatch',
      { words: picked.map((p) => p.word), contextTopic: settings.contextTopic, level },
      { timeoutMs: ENRICH_TIMEOUT_MS, retries: 0 },
    );
    // Re-key by lowercase word — repair() only trims/dedupes each item, it never
    // knows which words were actually requested, so extras/omissions/reordering are
    // handled here, not there (docs/decision.md ADR-019).
    enrichedByWord = new Map(result.items.map((item) => [item.word.toLowerCase(), item]));
  } catch {
    degraded = true; // offline, rate-limited, or timed out — every picked word falls back to its corpus gloss
  }

  let added = 0;
  for (const entry of picked) {
    const enriched = enrichedByWord.get(entry.word.toLowerCase());
    await repos.words.addFromCorpus({
      word: entry.word,
      meaningVi: enriched?.meaningVi || entry.vi,
      exampleSentence: enriched?.exampleSentence ?? '',
      distractors: enriched?.distractors ?? [],
      cefr: entry.band,
      source: { kind: 'session', label: `Gợi ý theo trình độ ${level}`, at: now },
      triage: 'unknown',
      now,
    });
    added += 1;
    if (!enriched) degraded = true;
  }

  await repos.meta.put(addedTodayKey(now), addedTodayCount + added);
  return { added, degraded };
}

export const useTopupStore = create<TopupStoreState>()(() => ({
  async ensureSupply({ now, targetSize }) {
    if (inFlight) return inFlight;
    inFlight = run(now, targetSize).finally(() => {
      inFlight = null;
    });
    return inFlight;
  },
}));
