import type { ExerciseKind, Word } from '@/lib/domain';

export interface SessionCaps {
  audioAvailable: boolean;
  aiAvailable: boolean;
}

export interface SessionItem {
  wordId: string;
  kind: ExerciseKind;
  // Frozen at session-build time — docs/decision.md ADR-004. A background
  // enrichment finishing mid-session must not swap content out from under a card
  // the user is actively answering.
  snapshot: Word;
  position: number;
}

export interface SessionAnswer {
  correct: boolean;
  at: number;
  kind: ExerciseKind;
}

export interface StudySession {
  id: string;
  createdAt: number;
  dayKey: string;
  items: SessionItem[]; // never mutated after buildSession() — length is fixed for the session's lifetime
  index: number;
  answers: Record<string, SessionAnswer>; // keyed by wordId
  status: 'active' | 'done';
}
