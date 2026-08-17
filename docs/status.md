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
- Login gate with a guest "try it" mode — guests learn and practise normally but stay off the
  leaderboard, cannot upload documents, and do not sync (`lib/auth/guest.ts`)

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

**Reminder emails can now be automated, but the automation needs its own deploy step.**
`app/api/cron/send-reminders` sends the daily digest for every learner whose `reminderHour`
(Cài đặt/Lịch học) matches the current Asia/Ho_Chi_Minh hour and who has words due — but nothing
calls that route by itself. It's meant to sit behind a Cloud Scheduler job hitting it once an hour
with header `x-cron-secret: $CRON_SECRET`; see the exact `gcloud scheduler jobs create http`
invocation below. Until that job is created, reminders still only go out when the learner taps
"Gửi email nhắc học thử ngay" in Settings — same as before (ADR-027).

Two things gate the automated path per learner, beyond the scheduler existing at all: they must
have connected Gmail *while signed in* (a guest, or someone who connected Gmail before ADR-027
shipped, has no server-side token — the interactive button still works via the cookie either way),
and `FIREBASE_ADMIN_*`/Application Default Credentials must be configured so the cron route can
read Firestore via the Admin SDK.

```
gcloud scheduler jobs create http lexio-send-reminders \
  --schedule="0 * * * *" \
  --time-zone="Asia/Ho_Chi_Minh" \
  --uri="$APP_URL/api/cron/send-reminders" \
  --http-method=POST \
  --headers="x-cron-secret=$CRON_SECRET" \
  --attempt-deadline=120s
```

**Accessibility is checked, not exhaustively audited.** `npm run lint` enforces 22 `jsx-a11y` rules
as errors (the Next preset ships six, all warnings), and `npm run a11y` runs axe-core against nine
routes in both themes — currently zero violations at any impact level. What that does *not* cover:
manual keyboard-only walkthroughs, screen-reader testing, and focus management inside the bottom
sheet (it announces itself as a dialog but does not trap focus).

**Session cookies are not signed.** `lexio_user_session` is base64 JSON, so a scripted client can
forge one and reach the features gated on "signed in" (document upload). The guard is a product gate,
not a security boundary — actual spend is protected by the origin check and the per-IP rate limiter,
which a forged cookie does not bypass. Signing the cookie, or moving to a Firebase session cookie via
the Admin SDK, is the fix; see `competition-audit.md` §6.2.
