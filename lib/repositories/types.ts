import type { CandidateWord, ExerciseKind, GrammarAttempt, Import, Review, UserSettings, UserStats, Word, WordSource, WordStatus } from '@/lib/domain';
import type { StudySession } from '@/lib/srs/types';

export interface NewWordInput {
  word: string;
  source: WordSource;
  // Fields enrichment fills in later — omitted here so a freshly-added word can be
  // written immediately with placeholders and enriched in the background (spec §7.1
  // flow), which is also what makes the old stale-closure bug (audit #9)
  // structurally impossible: the repository returns the persisted row with a real
  // id, so the caller never has to search an in-memory array for it again.
}

export interface ListWordsQuery {
  status?: WordStatus;
  search?: string;
  limit: number;
  offset?: number;
}

export interface WordRepository {
  get(id: string): Promise<Word | null>;
  getByWord(word: string): Promise<Word | null>;
  list(query: ListWordsQuery): Promise<Word[]>;
  countByStatus(): Promise<Record<WordStatus, number>>;
  add(input: NewWordInput): Promise<Word>;
  addMany(inputs: NewWordInput[]): Promise<Word[]>;
  patch(id: string, patch: Partial<Word>): Promise<Word>;
  remove(id: string): Promise<void>;
  dueBefore(now: number, limit: number): Promise<Word[]>;
  newNeverReviewed(limit: number, excludeIds: readonly string[]): Promise<Word[]>;
  leeches(limit: number): Promise<Word[]>;
}

export interface ReviewRepository {
  listByWord(wordId: string, limit: number): Promise<Review[]>;
  countByDayRange(fromDayKey: string, toDayKey: string): Promise<Record<string, number>>;
  purgeOlderThan(dayKey: string): Promise<number>;
}

export interface UserProfile {
  settings: UserSettings;
  stats: UserStats;
}

export interface UserRepository {
  getProfile(): Promise<UserProfile>;
  updateSettings(patch: Partial<UserSettings>): Promise<UserSettings>;
}

export interface RecordReviewInput {
  wordId: string;
  kind: ExerciseKind;
  correct: boolean;
  now: number; // caller owns the clock — see docs/decision.md ADR-004
  sessionId: string;
}

export interface RecordReviewResult {
  word: Word;
  stats: UserStats;
  review: Review;
}

/** The transactional unit of work — see docs/decision.md ADR-005. A single Dexie
 * transaction that reads the word from the DB (never a caller-supplied snapshot),
 * reschedules it, appends a Review, and increments UserStats counters. All three
 * succeed or none do. */
export interface StudyRepository {
  recordReview(input: RecordReviewInput): Promise<RecordReviewResult>;
  /** Persists the in-progress session after every answer, so a reload mid-session
   * (F5) resumes at the same card instead of building a fresh one. */
  saveSession(session: StudySession): Promise<void>;
  loadActiveSession(dayKey: string): Promise<StudySession | null>;
}

export interface NewImportInput {
  fileName: string;
  kind: Import['kind'];
}

/** Backs the "Tải tài liệu" screen (docs/progress/board.md Phase 7). One row per
 * paste/upload: starts 'analyzing', becomes 'ready' with AI-extracted candidates,
 * 'done' once the user confirms triage and words are added, or 'failed' with a
 * Vietnamese `error` message. */
export interface ImportRepository {
  create(input: NewImportInput): Promise<Import>;
  get(id: string): Promise<Import | null>;
  list(limit?: number): Promise<Import[]>;
  setCandidates(id: string, candidates: CandidateWord[]): Promise<Import>;
  setTriage(id: string, word: string, triage: CandidateWord['triage']): Promise<Import>;
  fail(id: string, error: string): Promise<Import>;
  complete(id: string, addedCount: number): Promise<Import>;
}

/** Independent of Word/Review (docs/decision.md ADR-011, spec-gaps.md C8) — a
 * GrammarQuestion has no Word to link a review to, so grammar practice gets its
 * own tiny history table instead of forcing a fake wordId through recordReview. */
export interface GrammarRepository {
  recordAttempt(topicId: string, score: number, total: number, now: number): Promise<GrammarAttempt>;
  lastAttemptByTopic(): Promise<Record<string, GrammarAttempt>>;
}

export interface Repositories {
  words: WordRepository;
  reviews: ReviewRepository;
  user: UserRepository;
  study: StudyRepository;
  imports: ImportRepository;
  grammar: GrammarRepository;
}
