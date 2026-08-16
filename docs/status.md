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

## Known gaps

**Google Sign-In is built but disabled.** It stalls on the Firebase auth handler, most likely a
missing authorized redirect URI. Email and password sign-in is the working path, and the button is
hidden behind a flag rather than shown broken.

**The leaderboard roster is sample data.** Only the signed-in user's own row is computed from real
notebook and review history; the other entries are a fixed roster, labelled as samples in the app.
Ranking live learners against each other needs a server-side aggregate that is out of scope.

**Seven migration tests are failing** in `lib/db/__tests__/migrations.test.ts` — reported as 14
because the suite runs under two timezones. They cover `migrateFromLocalStorage` and `seedIfEmpty`,
and fail on `localStorage` setup in the test harness rather than in the migration logic itself. They
do not touch the AI, sync, or document paths, but the suite is red until they are fixed.

**Reminder emails are sent on demand.** There is no scheduler; the learner triggers the digest from
Settings.

**Accessibility pass not started.** Phase 8 in `progress/board.md` — keyboard and screen-reader
review, plus the last of the legacy CSS token cleanup.
