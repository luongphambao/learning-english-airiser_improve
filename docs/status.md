# Project status

Kept out of the README on purpose: the README introduces the product, this file tracks what is
actually finished and what is not. For the phase-by-phase breakdown see
[`progress/board.md`](progress/board.md).

## Working end to end

- Vocabulary notebook and the spaced-repetition engine
- All six Gemini features — work-document analysis, PDF/DOCX mining, word extraction, enrichment,
  sentence grading, and text-to-speech
- PDF and DOCX ingestion, including on Cloud Run
- Firebase accounts and two-way Firestore sync
- Gmail study reminders
- Offline placement test
- Progress and grammar screens
- Vietnamese and English interfaces, light and dark themes
- Real cross-user leaderboard (`docs/decision.md` ADR-025) — every signed-in user's aggregate stats
  publish to a shared `leaderboard/{uid}` Firestore collection after each sync

## Known gaps

**Google Sign-In is built but disabled.** It stalls on the Firebase auth handler, most likely a
missing authorized redirect URI. Email and password sign-in is the working path, and the button is
hidden behind a flag rather than shown broken.

**Leaderboard numbers are client-computed, not server-verified.** `firestore.rules` validates shape
and internal consistency (field whitelist, non-negative counts, `totalCorrect <= totalReviews`,
a bounded `updatedAt`), but nothing compares a published doc against the learner's actual notebook —
there is no server in this project to do that comparison. Accepted for a personal app; see ADR-025
for the exact escalation path (a Cloud Function mirroring `users/{uid}`'s stats) if it's ever needed.
The board is also capped at the 200 most recently active learners
(`orderBy('updatedAt','desc') limit(200)`) — the UI discloses this only once the cap actually binds.
**Deploying `firestore.rules` is required** for the board to show anyone but yourself — without it
every leaderboard read fails silently into "just my own row", which is easy to misdiagnose as "no
one else uses this app yet" rather than "rules were never deployed".

**Seven migration tests are failing** in `lib/db/__tests__/migrations.test.ts` — reported as 14
because the suite runs under two timezones. They cover `migrateFromLocalStorage` and `seedIfEmpty`,
and fail on `localStorage` setup in the test harness rather than in the migration logic itself. They
do not touch the AI, sync, or document paths, but the suite is red until they are fixed.

**Reminder emails are sent on demand.** There is no scheduler; the learner triggers the digest from
Settings.

**Accessibility pass not started.** Phase 8 in `progress/board.md` — keyboard and screen-reader
review, plus the last of the legacy CSS token cleanup.
