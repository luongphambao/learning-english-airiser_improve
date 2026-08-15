import type { CandidateWord, Cefr, EntryType, ExerciseKind, GrammarAttempt, Import, Review, UserSettings, UserStats, Word, WordSource, WordStatus, WorkAnalysis } from '@/lib/domain';
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

/** One saved "Học từ công việc thật" insight (docs/decision.md ADR-014) — a phrase
 * or grammar-fix, written as a `words` row with `entryType` set, in one transaction.
 * Unlike NewWordInput, the AI has already supplied everything enrichWord would have
 * filled in later, so there is no placeholder-then-enrich step here. */
export interface NewInsightWordInput {
  text: string; // becomes Word.word
  entryType: EntryType;
  source: WordSource;
  meaningVi: string;
  noteVi: string;
  exampleSentence: string;
  distractors: string[];
  originalText: string | null;
  // docs/decision.md ADR-016/017 — analyzeWork already returns a per-item cefr
  // (lib/ai/tasks/contracts.ts WorkVocabItem) that used to be parsed and discarded
  // at save time. null for phrases/grammar/rewrites, which have no meaningful band.
  cefr: Cefr | null;
  now: number; // caller owns the clock — see docs/decision.md ADR-004
}

/** A word seeded from the corpus (lib/corpus/**) — placement triage
 * (app/(stack)/placement/page.tsx) and the auto top-up (stores/topup-store.ts) are
 * the two callers. `exampleSentence`/`distractors` may be empty — the "degraded"
 * path (docs/decision.md ADR-018) writes a corpus word with only its Vietnamese
 * gloss when AI enrichment isn't available, so a session is never empty even
 * offline; enrichment fills them in later without changing SRS state. */
export interface NewCorpusWordInput {
  word: string;
  meaningVi: string;
  exampleSentence: string;
  distractors: string[];
  cefr: Cefr;
  source: WordSource;
  /** 'known' never reaches this — the caller writes to SkippedRepository instead
   * (spec §8.3). */
  triage: 'partial' | 'unknown';
  now: number;
}

export interface ListWordsQuery {
  status?: WordStatus;
  entryType?: EntryType;
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
  /** Scheduled immediately (dueAt=now, like a fresh `applyTriage('unknown', ...)`
   * word) — saving from Learn is always "I want to learn this", never "I already
   * know this". On a duplicate `wordLower`, updates the content fields but
   * PRESERVES the existing SRS state (dueAt/easeLevel/reviewCount/...) — re-saving
   * an already-practiced phrase must not reset its schedule. */
  addFromInsight(input: NewInsightWordInput): Promise<Word>;
  /** Same check-then-write-in-one-transaction shape as addFromInsight — a corpus
   * word and a hand-typed/pasted word share the &wordLower namespace, so re-seeding
   * an already-known word is a no-op on its SRS state, not a duplicate row. */
  addFromCorpus(input: NewCorpusWordInput): Promise<Word>;
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
  /** Most recent reviews across every word, newest first — backs the SRS level
   * signal (lib/level/srs-signal.ts), which needs a cross-word accuracy sample, not
   * one word's history. */
  listRecent(limit: number): Promise<Review[]>;
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
  /** kind 'work' only — persisted so a failed analysis can be retried without the
   * user re-pasting their text. */
  rawText?: string;
}

/** Backs the "Tải tài liệu" / "Học từ công việc thật" screens (docs/progress/board.md
 * Phase 7; docs/decision.md ADR-014). One row per paste/upload: starts 'analyzing',
 * becomes 'ready' with AI-extracted candidates (kind text/pdf/image) or a work
 * analysis (kind 'work'), 'done' once the user confirms and words are added, or
 * 'failed' with a Vietnamese `error` message. */
export interface ImportRepository {
  create(input: NewImportInput): Promise<Import>;
  get(id: string): Promise<Import | null>;
  list(limit?: number): Promise<Import[]>;
  setCandidates(id: string, candidates: CandidateWord[]): Promise<Import>;
  setTriage(id: string, word: string, triage: CandidateWord['triage']): Promise<Import>;
  /** kind 'work' — the analogue of setCandidates for a work analysis: writes the
   * normalized result and moves status to 'ready'. */
  setAnalysis(id: string, analysis: WorkAnalysis): Promise<Import>;
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

/** "Đã biết rõ" — words the user has explicitly said they already know, so the
 * corpus top-up (lib/corpus/exclude.ts) never suggests them again. Backs the
 * `skipped` table (lib/db/dexie.ts v1), which existed since the original schema but
 * had no repository until docs/decision.md ADR-017. */
export interface SkippedRepository {
  add(word: string, now: number): Promise<void>;
  has(word: string): Promise<boolean>;
  listLowercase(): Promise<string[]>;
  remove(word: string): Promise<void>;
}

/** Thin typed wrapper over the `meta` KV table (lib/db/dexie.ts) — the auto top-up's
 * throttle bookkeeping (stores/topup-store.ts: last-run timestamp, per-day word
 * cap) needs simple key/value persistence, not a domain repository of its own. Kept
 * generic rather than adding single-purpose methods so it doesn't grow one method
 * per future throttle. */
export interface MetaRepository {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
}

export interface Repositories {
  words: WordRepository;
  reviews: ReviewRepository;
  user: UserRepository;
  study: StudyRepository;
  imports: ImportRepository;
  grammar: GrammarRepository;
  skipped: SkippedRepository;
  meta: MetaRepository;
}
