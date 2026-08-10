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
  }
}

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
