import type { ExerciseKind, Word } from '@/lib/domain';
import { splitForBlank } from '@/lib/text/blank';
import { dayKey } from './date';
import type { SessionCaps, SessionItem, StudySession } from './types';

// docs/spec-gaps.md §B — the spec's exercise-serving rules genuinely conflict:
// Build steps 5/6 pin the sequence fillBlank,listen,write,listen,fillBlank; §8.2
// requires a leech sit at position 1 and NEVER be fillBlank (a direct clash at
// position 1); Build step 14 gates `recall` on reviewCount>=3 while §8.3 grants it
// immediately (reviewCount===0) to a `partial`-triaged word (a direct clash).
// Resolution (docs/decision.md ADR-008): the positional sequence is a *preference*;
// `isEligible()` is the *law*. Tradeoff: the 5-card rhythm is no longer guaranteed
// identical session to session — accepted because the alternative is showing a
// leech as the exact exercise type the spec says has stopped working for it.
const PREFERRED_BY_POSITION: readonly ExerciseKind[] = ['fillBlank', 'listen', 'write', 'listen', 'fillBlank'];
const FALLBACK_ORDER: readonly ExerciseKind[] = ['listen', 'fillBlank', 'recall', 'write'];

export function isEligible(kind: ExerciseKind, word: Word, caps: SessionCaps): boolean {
  switch (kind) {
    case 'fillBlank':
      // never a leech (spec §8.2); needs 3 distractors and the word to actually
      // appear inside its own example sentence (lib/text/blank.ts — a word that
      // isn't found there can't be blanked out).
      return !word.isLeech && word.distractors.length >= 3 && splitForBlank(word.exampleSentence, word.word) !== null;
    case 'listen':
      return word.exampleSentence.length > 0 && caps.audioAvailable;
    case 'recall':
      // reconciles Build-step-14 (reviewCount >= 3) with spec §8.3 (a `partial`
      // triage grants immediate recall via easeLevel 2 at reviewCount 0). The
      // easeLevel>=2 branch is only reachable through applyTriage('partial'), so
      // this exception is narrow and self-documenting.
      return word.reviewCount >= 3 || (word.easeLevel >= 2 && word.reviewCount === 0);
    case 'write':
      return caps.aiAvailable;
    case 'grammar':
      return false; // grammar is its own screen, not a session item
    default:
      return false;
  }
}

function dedupeById(words: readonly Word[]): Word[] {
  const seen = new Set<string>();
  const out: Word[] = [];
  for (const word of words) {
    if (seen.has(word.id)) continue;
    seen.add(word.id);
    out.push(word);
  }
  return out;
}

/** Picks a fallback kind different from `avoid` that this word is eligible for. */
function fallbackFor(word: Word, caps: SessionCaps, avoid: ExerciseKind): ExerciseKind | null {
  return FALLBACK_ORDER.find((k) => k !== avoid && isEligible(k, word, caps)) ?? null;
}

export interface BuildSessionInput {
  sessionId: string; // caller-generated (e.g. lib/db/ids.newId()) — keeps this function free of I/O
  due: readonly Word[]; // words with dueAt <= now, ideally already sorted ascending by dueAt
  leech: readonly Word[]; // at most the leeches eligible for this session; only the first is used
  fresh: readonly Word[]; // never-reviewed words to fill out the session if `due` is short
  now: number;
  size: number;
  caps: SessionCaps;
}

/**
 * Builds a study session ONCE. The returned `items` array never changes length or
 * order after this call — see docs/decision.md ADR-004. This is what makes the old
 * TodayScreen bug (index advancing independently of a shrinking `dueWords` memo)
 * structurally impossible: nothing downstream re-derives `items` from the mutating
 * word list.
 */
export function buildSession(input: BuildSessionInput): StudySession {
  const picked = dedupeById([...input.leech.slice(0, 1), ...input.due, ...input.fresh]).slice(0, input.size);

  const rawItems: SessionItem[] = picked.map((word, position) => {
    const preferred = PREFERRED_BY_POSITION[position];
    const candidates = preferred ? [preferred, ...FALLBACK_ORDER] : FALLBACK_ORDER;
    const kind =
      candidates.find((k) => isEligible(k, word, input.caps)) ??
      (input.caps.aiAvailable ? 'write' : 'recall'); // terminal: always answerable somehow
    return { wordId: word.id, kind, snapshot: word, position };
  });

  // Budget: at most one AI-graded `write` per session (spec intent — write is the
  // most expensive exercise). Extras get demoted to whatever else they're eligible
  // for; if nothing else fits, they keep `write` rather than showing nothing.
  let writeUsed = false;
  const items = rawItems.map((item) => {
    if (item.kind !== 'write') return item;
    if (!writeUsed) {
      writeUsed = true;
      return item;
    }
    const alt = fallbackFor(item.snapshot, input.caps, 'write');
    return alt ? { ...item, kind: alt } : item;
  });

  return {
    id: input.sessionId,
    createdAt: input.now,
    dayKey: dayKey(input.now),
    items,
    index: 0,
    answers: {},
    status: items.length === 0 ? 'done' : 'active',
  };
}
