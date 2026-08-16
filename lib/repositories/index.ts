import { createDexieWordRepository } from './dexie/word-repository';
import { createDexieReviewRepository } from './dexie/review-repository';
import { createDexieUserRepository } from './dexie/user-repository';
import { createDexieStudyRepository } from './dexie/study-repository';
import { createDexieImportRepository } from './dexie/import-repository';
import { createDexieGrammarRepository } from './dexie/grammar-repository';
import { createDexieSkippedRepository } from './dexie/skipped-repository';
import { createDexieMetaRepository } from './dexie/meta-repository';
import type { Repositories } from './types';

export type { Repositories, WordRepository, ReviewRepository, UserRepository, StudyRepository, ImportRepository,
  GrammarRepository, SkippedRepository, MetaRepository, NewWordInput, NewInsightWordInput, NewCorpusWordInput,
  ListWordsQuery, RecordReviewInput, RecordReviewResult, UserProfile, NewImportInput } from './types';

let cached: Repositories | null = null;

/**
 * The one seam in the whole app: every screen/store reaches persistence through
 * this function, never through lib/db/dexie.ts directly. Swapping to a Firestore
 * backend later means writing lib/repositories/firestore/** and changing only what
 * this function returns — see docs/architecture.md §1 and docs/data-model.md §5.
 */
export function getRepos(): Repositories {
  if (!cached) {
    cached = {
      words: createDexieWordRepository(),
      reviews: createDexieReviewRepository(),
      user: createDexieUserRepository(),
      study: createDexieStudyRepository(),
      imports: createDexieImportRepository(),
      grammar: createDexieGrammarRepository(),
      skipped: createDexieSkippedRepository(),
      meta: createDexieMetaRepository(),
    };
  }
  return cached;
}

/**
 * Drops the memoized repositories so the next getRepos() call re-reads
 * getDb()'s current database. Two callers:
 *  - Tests (lib/repositories/__tests__, stores/__tests__), after
 *    resetDbForTests() swaps in a fresh fake-indexeddb instance.
 *  - app/providers.tsx's AuthProvider, after setActiveUser(uid) swaps the
 *    per-account database on sign-in/sign-out/account-switch — without this,
 *    getRepos() would keep serving repository objects wired to the previous
 *    account's now-closed Dexie connection.
 */
export function resetRepos(): void {
  cached = null;
}
