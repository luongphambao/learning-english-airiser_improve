import { create } from 'zustand';
import { getRepos } from '@/lib/repositories';
import { buildSession, buildReviewSession } from '@/lib/srs/session';
import { dayKey } from '@/lib/srs/date';
import { newId } from '@/lib/db/ids';
import { useLevelStore } from './level-store';
import { useSyncStore } from './sync-store';
import type { StudySession } from '@/lib/srs/types';

// Exported so Home (app/(tabs)/today/page.tsx) can render a due/fresh count that
// matches what /practice will actually serve — never a number the session can't
// deliver. The REAL session size is now settings.sessionSize (docs/decision.md
// ADR-018); this is only the fallback baked into DEFAULT_SETTINGS.
export const DEFAULT_SESSION_SIZE = 5;

/** How many words a free-review round may draw from. Bounded so a very large
 * notebook doesn't read every row into memory just to pick `sessionSize` of them. */
const REVIEW_POOL_SIZE = 300;

/** 'scheduled' is the normal SRS session (due + leech + new). 'review' ignores the
 * schedule entirely and draws at random from the notebook — the "ôn tập ngẫu
 * nhiên" option offered once nothing is due and no new word is left. */
export type SessionMode = 'scheduled' | 'review';

interface SessionStoreState {
  session: StudySession | null;
  status: 'idle' | 'building' | 'active' | 'done' | 'error';
  /** Which kind of session `session` is — drives the completion screen's wording
   * (a free-review round shouldn't claim the daily plan is finished). */
  mode: SessionMode;
  error: string | null;
  start(opts: { now: number; mode?: SessionMode }): Promise<void>;
  /** Discards a finished session and immediately builds the next one. Backs the
   * "Học tiếp" / "Ôn tập ngẫu nhiên" buttons on the completion screen: without it
   * the only way to a second round was leaving the tab and coming back. */
  startNext(opts: { now: number; mode?: SessionMode }): Promise<void>;
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
  mode: 'scheduled',
  error: null,

  async start({ now, mode = 'scheduled' }) {
    set({ status: 'building', error: null, mode });
    try {
      const repos = getRepos();
      const today = dayKey(now);

      // A free-review round is always freshly built — resuming here would hand
      // back the scheduled session the user just finished.
      if (mode === 'scheduled') {
        const resumed = await repos.study.loadActiveSession(today);
        if (resumed) {
          set({ session: resumed, status: resumed.status });
          return;
        }
      }

      const { settings } = await repos.user.getProfile();
      const size = settings.sessionSize;
      // docs/decision.md ADR-018 — a real (if coarse) capability probe: `write` needs
      // gradeSentence and `listen` can fetch TTS, both AI calls that fail outright
      // when the browser is offline. navigator.onLine can't detect "online but the
      // AI provider itself is down" (Phase 6+ would wire a real /api/ai/capabilities
      // GET for that), but it's what makes the isEligible('recall') degraded-word
      // exception actually reachable offline instead of serving a dead write/listen
      // card that immediately errors.
      const online = typeof navigator === 'undefined' || navigator.onLine;
      const caps = { audioAvailable: online, aiAvailable: online };
      const sessionId = newId('s_');

      let session: StudySession;
      if (mode === 'review') {
        const words = await repos.words.list({ limit: REVIEW_POOL_SIZE });
        session = buildReviewSession({ sessionId, words, now, size, caps });
      } else {
        const due = await repos.words.dueBefore(now, size * 2);
        const leech = await repos.words.leeches(1);
        const fresh = await repos.words.newNeverReviewed(
          size,
          due.map((w) => w.id),
        );
        session = buildSession({ sessionId, due, leech, fresh, now, size, caps });
      }

      if (session.items.length > 0) await repos.study.saveSession(session);
      set({ session, status: session.status });
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : 'unknown_error' });
    }
  },

  async startNext({ now, mode = 'scheduled' }) {
    set({ session: null, status: 'idle', error: null });
    await get().start({ now, mode });
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

    // docs/decision.md ADR-017 — session end, not per-card: costs nothing on the hot
    // answer path, and any "level changed" note lands on the completion screen the
    // user is already looking at, never mid-session (ADR-004 — items are frozen).
    // Fire-and-forget: a failed level refresh must not block the completion screen.
    if (nextSession.status === 'done') {
      void useLevelStore.getState().refreshSrsSignal(now);
      // lib/sync/** — one of the moments docs/data-model.md calls out for an
      // automatic sync (the words just reviewed/rescheduled are exactly what
      // another device most wants to see next). No-ops silently if signed
      // out (stores/sync-store.ts).
      void useSyncStore.getState().sync(now);
    }
  },

  reset() {
    set({ session: null, status: 'idle', mode: 'scheduled', error: null });
  },
}));
