import { getDb, USER_ID } from './dexie';
import { toRow } from './rows';
import { newId } from './ids';
import { safeParseRow, quarantineRow } from './read';
import { WordSchema, UserStatsSchema, UserSettingsSchema, type Word } from '@/lib/domain';
import { DEFAULT_SETTINGS, DEFAULT_STATS } from '@/lib/repositories/dexie/user-repository';
import { SOURCE_KEY } from '@/lib/i18n/source-label';

const MIGRATION_FLAG = 'migrated:localStorage';
const SEEDED_FLAG = 'seeded';

const LS_WORDS_KEY = 'lexio_words';
const LS_STATS_KEY = 'lexio_stats';
const LS_SETTINGS_KEY = 'lexio_settings';

function readJson(key: string): unknown {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * A Word migrated from the pre-Dexie localStorage blob is missing the fields added
 * since (docs/decision.md ADR-007) and — because of the old TodayScreen bug
 * (docs/progress/00-baseline-audit.md §2 bug #3) — may carry a `dueAt` frozen at
 * Feb 2025. `repair` backfills the new fields; it deliberately does NOT touch
 * `dueAt` (a stale-but-valid due date is still meaningful — it just means the word
 * is very overdue, which is correct, not corrupt).
 */
function repairWord(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw;
  const r = raw as Record<string, unknown>;
  return {
    ...r,
    consecutiveCorrect: typeof r.consecutiveCorrect === 'number' ? r.consecutiveCorrect : 0,
    updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : (r.createdAt ?? Date.now()),
    deletedAt: r.deletedAt ?? null,
  };
}

/**
 * Runs once (guarded by meta['migrated:localStorage']). Reads the three legacy
 * localStorage keys, validates+repairs each entry, writes everything into Dexie in
 * one transaction. Never deletes the original localStorage keys — a mis-parse still
 * leaves the source data recoverable. See docs/data-model.md §3.
 */
export async function migrateFromLocalStorage(now: number = Date.now()): Promise<{ migrated: boolean; wordCount: number }> {
  const db = getDb();
  const already = await db.meta.get(MIGRATION_FLAG);
  if (already) return { migrated: false, wordCount: 0 };

  const rawWords = readJson(LS_WORDS_KEY);
  const rawStats = readJson(LS_STATS_KEY);
  const rawSettings = readJson(LS_SETTINGS_KEY);

  const words: Word[] = [];
  if (Array.isArray(rawWords)) {
    for (const raw of rawWords) {
      const result = safeParseRow(WordSchema, raw, repairWord);
      if (result.ok) {
        words.push(result.value);
      } else if (raw && typeof raw === 'object' && 'id' in raw) {
        await quarantineRow(db, 'words', String((raw as Record<string, unknown>).id), raw, result.issues);
      }
    }
  }

  const statsResult = rawStats ? safeParseRow(UserStatsSchema, rawStats) : null;
  const settingsResult = rawSettings ? safeParseRow(UserSettingsSchema, rawSettings) : null;

  await db.transaction('rw', db.words, db.user, db.meta, async () => {
    for (const word of words) {
      await db.words.put(toRow(word, now));
    }
    await db.user.put({
      id: USER_ID,
      settings: settingsResult?.ok ? settingsResult.value : DEFAULT_SETTINGS,
      stats: statsResult?.ok ? statsResult.value : DEFAULT_STATS,
      updatedAt: now,
    });
    await db.meta.put({ key: MIGRATION_FLAG, value: { at: now, wordCount: words.length } });
  });

  return { migrated: true, wordCount: words.length };
}

const SEED_WORDS: Array<Pick<Word, 'word' | 'ipa' | 'partOfSpeech' | 'meaningVi' | 'exampleSentence' | 'distractors'>> = [
  {
    word: 'trade-off',
    ipa: '/ˈtreɪd ɒf/',
    partOfSpeech: 'noun',
    meaningVi: 'Sự đánh đổi giữa các lựa chọn',
    exampleSentence: 'Engineering requires a careful trade-off between speed and security.',
    distractors: ['breakthrough', 'consensus', 'bottleneck'],
  },
  {
    word: 'deprecate',
    ipa: '/ˈdep.rə.keɪt/',
    partOfSpeech: 'verb',
    meaningVi: 'Ngưng hỗ trợ một tính năng hoặc API cũ',
    exampleSentence: 'We will deprecate the v1 endpoint next month.',
    distractors: ['compile', 'instantiate', 'refactor'],
  },
  {
    word: 'bottleneck',
    ipa: '/ˈbɒt.əl.nek/',
    partOfSpeech: 'noun',
    meaningVi: 'Điểm nghẽn gây chậm toàn bộ hệ thống',
    exampleSentence: 'The missing index was the primary bottleneck during peak traffic.',
    distractors: ['benchmark', 'pipeline', 'deployment'],
  },
  {
    word: 'mitigate',
    ipa: '/ˈmɪt.ɪ.ɡeɪt/',
    partOfSpeech: 'verb',
    meaningVi: 'Giảm thiểu rủi ro hoặc tác động tiêu cực',
    exampleSentence: 'Rate limiting helps mitigate denial-of-service risk.',
    distractors: ['exacerbate', 'stimulate', 'provoke'],
  },
  {
    word: 'redundant',
    ipa: '/rɪˈdʌn.dənt/',
    partOfSpeech: 'adjective',
    meaningVi: 'Dư thừa, có phương án dự phòng',
    exampleSentence: 'We deployed redundant multi-region servers to prevent downtime.',
    distractors: ['scarce', 'obsolete', 'vulnerable'],
  },
];

/**
 * If, after migration, the notebook is still empty, insert the same 5 demo words
 * the old INITIAL_WORDS seeded — but with `dueAt = now` (not a frozen timestamp,
 * see bug #3) and a `meta['seeded']` flag so deleting them doesn't bring them back.
 */
export async function seedIfEmpty(now: number = Date.now()): Promise<boolean> {
  const db = getDb();
  const alreadySeeded = await db.meta.get(SEEDED_FLAG);
  if (alreadySeeded) return false;

  const count = await db.words.count();
  if (count > 0) {
    await db.meta.put({ key: SEEDED_FLAG, value: true });
    return false;
  }

  await db.transaction('rw', db.words, db.meta, async () => {
    for (const seed of SEED_WORDS) {
      const word: Word = {
        id: newId('w_'),
        ...seed,
        collocations: [],
        wordFamily: [],
        source: { kind: 'manual', label: SOURCE_KEY.manual, at: now },
        audioUrl: null,
        createdAt: now,
        dueAt: now,
        easeLevel: 0,
        reviewCount: 0,
        lapseCount: 0,
        consecutiveCorrect: 0,
        isLeech: false,
        status: 'new',
        updatedAt: now,
        deletedAt: null,
      };
      await db.words.put(toRow(word, now));
    }
    await db.meta.put({ key: SEEDED_FLAG, value: true });
  });

  return true;
}
