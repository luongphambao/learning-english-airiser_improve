import Dexie, { type Table } from 'dexie';
import type { GrammarAttempt, Review, Session, Import, UserSettings, UserStats } from '@/lib/domain';
import type { StudySession } from '@/lib/srs/types';
import type { WordRow } from './rows';

export interface ReviewRow extends Review {
  sessionId: string;
  dayKey: string;
  updatedAt: number;
}

export interface UserRow {
  id: string; // singleton row, always USER_ID
  settings: UserSettings;
  stats: UserStats;
  updatedAt: number;
}

export interface SkippedRow {
  wordLower: string;
  word: string;
  at: number;
}

export interface MetaRow {
  key: string;
  value: unknown;
}

export const USER_ID = 'local';

export class LexioDb extends Dexie {
  words!: Table<WordRow, string>;
  reviews!: Table<ReviewRow, string>;
  user!: Table<UserRow, string>;
  studySessions!: Table<StudySession, string>;
  tutorSessions!: Table<Session, string>;
  imports!: Table<Import, string>;
  skipped!: Table<SkippedRow, string>;
  meta!: Table<MetaRow, string>;
  grammarAttempts!: Table<GrammarAttempt, string>;

  constructor(name = 'lexio') {
    super(name);

    // v1 — see docs/data-model.md §2 for why each index exists. Additive-only from
    // here: an already-shipped version() block is never edited, only extended by a
    // new version(n+1).upgrade() (docs/decision.md, enforced by
    // lib/db/__tests__/migrations.test.ts).
    this.version(1).stores({
      words: 'id, &wordLower, dueAt, createdAt, status, [status+createdAt], [isLeech+dueAt], updatedAt',
      reviews: 'id, wordId, answeredAt, dayKey, [wordId+answeredAt]',
      user: 'id',
      studySessions: 'id, dayKey, status',
      tutorSessions: 'id, startsAt, status',
      imports: 'id, createdAt, status',
      skipped: '&wordLower, at',
      meta: 'key',
    });

    // v2 — docs/decision.md ADR-011 / spec-gaps.md C8: grammar quiz history, kept
    // independent of `words`/`reviews` (a GrammarQuestion has no Word to link to).
    // Only the new table needs declaring — unchanged v1 tables carry over as-is.
    this.version(2).stores({
      grammarAttempts: 'id, topicId, at',
    });

    // v3 — "Học từ công việc thật" (docs/decision.md ADR-014).
    //
    // Two deliberate non-additions, so the absence of new tables here isn't an
    // oversight:
    //  - No `phrases` table. A saved phrase/grammar-fix is a `words` row carrying
    //    an `entryType` discriminator (lib/domain/word.ts), so StudyRepository.
    //    recordReview (ADR-005), buildSession and nextSchedule schedule it with
    //    zero modification — they only ever see a `Word`.
    //  - No `workAnalyses` table. A work analysis is an `imports` row with
    //    kind:'work' and an `analysis` payload (lib/domain/import.ts) — the
    //    existing 'id, createdAt, status' index already serves every query this
    //    needs, same as it does for kind:'text'/'pdf'/'image' rows.
    //
    // The one real change: `words` gains `entryType` and a compound
    // `[entryType+dueAt]`. Dexie requires the FULL index list when a table is
    // re-declared in a new version — v1's block above is still never edited,
    // which is what the additive-only rule actually protects.
    //   entryType alone backs a future "Words vs Phrases" filter as an index
    //   range instead of a full-table scan; [entryType+dueAt] backs "how many
    //   phrases are due today" without reading every word row. Neither is
    //   consumed yet in this pass, but the index costs nothing to add now and
    //   everything to retrofit onto an already-large table later.
    //
    // The upgrade() backfill is NOT optional: IndexedDB omits a record from an
    // index entirely when its key path is undefined, so without this every
    // pre-v3 word would be invisible to `where('entryType')` — a silently empty
    // filter result, not a loud failure.
    this.version(3)
      .stores({
        words:
          'id, &wordLower, dueAt, createdAt, status, [status+createdAt], [isLeech+dueAt], updatedAt, entryType, [entryType+dueAt]',
      })
      .upgrade((tx) =>
        tx
          .table('words')
          .toCollection()
          .modify((w) => {
            w.entryType ??= 'word';
            w.noteVi ??= '';
            w.originalText ??= null;
          }),
      );

    // v4 — docs/decision.md ADR-016/017: a vocabulary corpus (lib/corpus/**) and a
    // leveling engine (lib/level/**) needed somewhere to record a word's CEFR band
    // and a user's evidence-backed level.
    //
    // `words` gains `cefr` and `[cefr+status]` — same reasoning the v3 block already
    // gave for `[entryType+dueAt]`: backs "how many known words per band" (the SRS
    // level signal) and a future "sổ tay theo trình độ" filter as an index range
    // instead of a full-table scan. Free to add now, expensive to retrofit later.
    //
    // `V4_SETTINGS_DEFAULTS` is a literal frozen right here, NOT an import of
    // DEFAULT_SETTINGS from lib/repositories/dexie/user-repository.ts: importing it
    // would create a cycle (that file imports getDb from this one), and a migration
    // must stay frozen in time — it must not follow a constant a later phase edits.
    this.version(4)
      .stores({
        words:
          'id, &wordLower, dueAt, createdAt, status, [status+createdAt], [isLeech+dueAt], updatedAt, entryType, [entryType+dueAt], cefr, [cefr+status]',
      })
      .upgrade(async (tx) => {
        await tx
          .table('words')
          .toCollection()
          .modify((w) => {
            w.cefr ??= 'unknown';
          });
        await tx
          .table('user')
          .toCollection()
          .modify((u) => {
            u.settings = { ...V4_SETTINGS_DEFAULTS, ...u.settings };
          });
      });
  }
}

const V4_SETTINGS_DEFAULTS = {
  sessionSize: 5,
  levelProfile: {
    declared: null,
    placement: null,
    work: null,
    srs: null,
    updatedAt: null,
    lastPromptedAt: null,
  },
};

let instance: LexioDb | null = null;

/** Lazily-created singleton so tests (fake-indexeddb) and the browser each get one
 * live connection instead of a new Dexie instance per repository call. */
export function getDb(): LexioDb {
  if (!instance) instance = new LexioDb();
  return instance;
}

/** Test-only: swap in a fresh, isolated database (see lib/repositories/__tests__). */
export function resetDbForTests(name?: string): LexioDb {
  instance?.close();
  instance = new LexioDb(name ?? `lexio-test-${newTestSuffix()}`);
  return instance;
}

let testCounter = 0;
function newTestSuffix() {
  testCounter += 1;
  return testCounter;
}
