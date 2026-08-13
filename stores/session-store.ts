import { create } from 'zustand';
import { getRepos } from '@/lib/repositories';
import { buildSession } from '@/lib/srs/session';
import { dayKey } from '@/lib/srs/date';
import { newId } from '@/lib/db/ids';
import type { StudySession } from '@/lib/srs/types';

// Exported so Home (app/(tabs)/today/page.tsx) can render a due/fresh count that
// matches what /practice will actually serve — never a number the session can't
// deliver.
export const SESSION_SIZE = 5;

interface SessionStoreState {
  session: StudySession | null;
  status: 'idle' | 'building' | 'active' | 'done' | 'error';
  error: string | null;
  start(opts: { now: number }): Promise<void>;
  answer(correct: boolean): Promise<void>;
  reset(): void;
}

/**
 * docs/decision.md ADR-004 — the session is built ONCE per start() call and never
 * re-derived from the (mutating) word list. This is what makes bug #10 (audit —
 * `dueWords` was a useMemo over `words`; answering shrank the memo while
 * `currentIndex` advanced independently, skipping cards) and bug #11 (`now` frozen
 * to a Feb-2025 constant, so the due filter never matched) structurally impossible:
 * `items.length` is fixed for the session's lifetime, and `now` is always the
 * caller's argument, never a module-level constant.
 */
export const useSessionStore = create<SessionStoreState>()((set, get) => ({
  session: null,
  status: 'idle',
  error: null,

  async start({ now }) {
    set({ status: 'building', error: null });
    try {
      const repos = getRepos();
      const today = dayKey(now);

      const resumed = await repos.study.loadActiveSession(today);
      if (resumed) {
        set({ session: resumed, status: resumed.status });
        return;
      }

      const due = await repos.words.dueBefore(now, SESSION_SIZE * 2);
      const leech = await repos.words.leeches(1);
      const fresh = await repos.words.newNeverReviewed(
        SESSION_SIZE,
        due.map((w) => w.id),
      );
      // Phase 6 wires real capability probing (TTS provider configured? AI provider
      // reachable?) via a small /api/ai/capabilities GET — see docs/api_document.md.
      // Until then, both are assumed available so the session shape matches the
      // exercises that already exist (fillBlank/listen/write/recall).
      const caps = { audioAvailable: true, aiAvailable: true };

      const session = buildSession({
        sessionId: newId('s_'),
        due,
        leech,
        fresh,
        now,
        size: SESSION_SIZE,
        caps,
      });

      if (session.items.length > 0) await repos.study.saveSession(session);
      set({ session, status: session.status });
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : 'unknown_error' });
    }
  },

  async answer(correct) {
    const { session } = get();
    if (!session || session.status !== 'active') return;
    const item = session.items[session.index];
    if (!item) return;
    if (session.answers[item.wordId]) return; // idempotent — a double-tap is a no-op

    const now = Date.now();
    await getRepos().study.recordReview({
      wordId: item.wordId,
      kind: item.kind,
      correct,
      now,
      sessionId: session.id,
    });

    const answers = { ...session.answers, [item.wordId]: { correct, at: now, kind: item.kind } };
    const index = session.index + 1;
    const nextSession: StudySession = {
      ...session,
      answers,
      index,
      status: index >= session.items.length ? 'done' : 'active',
    };
    await getRepos().study.saveSession(nextSession);
    set({ session: nextSession, status: nextSession.status });
  },

  reset() {
    set({ session: null, status: 'idle', error: null });
  },
}));
