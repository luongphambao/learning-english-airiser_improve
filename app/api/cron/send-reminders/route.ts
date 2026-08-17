import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { google } from 'googleapis';
import { getOAuth2Client, resolveOrigin } from '@/lib/auth/google';
import { buildReminderRawMessage } from '@/lib/gmail/render';
import { dayKey, hourOfDay } from '@/lib/srs/date';
import {
  findUidsWithReminderHour,
  getDueWordsForUser,
  getGmailTokensForUser,
  setGmailTokensForUser,
} from '@/lib/reminders/store';

// Never statically cache/optimize a cron trigger — every invocation must
// actually run.
export const dynamic = 'force-dynamic';

// Same digest size the interactive "send test email" button in Settings uses
// (app/(stack)/settings/page.tsx's dueBefore(now, 5)) — keeping the two
// consistent means "what you tested" is "what you'll actually get".
const WORDS_PER_REMINDER = 5;

/** Constant-time compare so a timing side-channel can't help brute-force
 * CRON_SECRET. `timingSafeEqual` throws on mismatched lengths, so that case
 * is short-circuited first — an observable length leak, not a content leak. */
function isValidCronSecret(provided: string | null): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

interface RunSummary {
  hourVN: number;
  dayKeyVN: string;
  candidates: number;
  sent: number;
  skippedNotConnected: number;
  skippedAlreadySentToday: number;
  skippedNoDueWords: number;
  failed: number;
}

/**
 * Fires once per hour off a Cloud Scheduler job hitting this endpoint with
 * header `x-cron-secret: $CRON_SECRET` (see docs/status.md for the exact
 * `gcloud scheduler jobs create http` invocation and docs/decision.md
 * ADR-027 for why this exists as a separate route from the interactive
 * Settings button rather than that route learning a "no body" mode).
 *
 * Per matching user: read due words and Gmail tokens straight from
 * Firestore via the Admin SDK — there is no browser here to carry a session
 * cookie or a Dexie database, which is exactly why lib/reminders/store.ts's
 * server-side token store and this Firestore read exist alongside the
 * client-side equivalents.
 */
export async function POST(req: NextRequest) {
  if (!isValidCronSecret(req.headers.get('x-cron-secret'))) {
    // Same status whether CRON_SECRET is unconfigured or the header is
    // wrong — never distinguish "server misconfigured" from "bad secret" to
    // an unauthenticated caller.
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const now = Date.now();
  const hourVN = hourOfDay(now);
  const dayKeyVN = dayKey(now);

  const summary: RunSummary = {
    hourVN,
    dayKeyVN,
    candidates: 0,
    sent: 0,
    skippedNotConnected: 0,
    skippedAlreadySentToday: 0,
    skippedNoDueWords: 0,
    failed: 0,
  };

  const uids = await findUidsWithReminderHour(hourVN);
  summary.candidates = uids.length;

  const appUrl = resolveOrigin();

  // Sequential on purpose: personal-app scale (findUidsWithReminderHour caps
  // at 200 candidates for one hour bucket), and it keeps one user's Gmail
  // API hiccup from racing another user's token refresh.
  for (const uid of uids) {
    try {
      const tokens = await getGmailTokensForUser(uid);
      if (!tokens || (!tokens.access_token && !tokens.refresh_token)) {
        summary.skippedNotConnected++;
        continue;
      }
      if (tokens.lastReminderDayKey === dayKeyVN) {
        // Already sent for today — guards against a retried/overlapping
        // Cloud Scheduler invocation double-sending.
        summary.skippedAlreadySentToday++;
        continue;
      }

      const words = await getDueWordsForUser(uid, now, WORDS_PER_REMINDER);
      if (words.length === 0) {
        summary.skippedNoDueWords++;
        continue;
      }

      const oauth2Client = getOAuth2Client();
      oauth2Client.setCredentials({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date,
      });
      oauth2Client.on('tokens', (newTokens) => {
        void setGmailTokensForUser(uid, {
          access_token: newTokens.access_token ?? tokens.access_token ?? null,
          refresh_token: newTokens.refresh_token ?? tokens.refresh_token ?? null,
          expiry_date: newTokens.expiry_date ?? tokens.expiry_date ?? null,
        });
      });

      const recipient = tokens.email || 'me';
      const encodedMessage = buildReminderRawMessage({ to: recipient, words, appUrl });

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encodedMessage } });

      await setGmailTokensForUser(uid, { lastReminderDayKey: dayKeyVN });
      summary.sent++;
    } catch (err) {
      // Same discipline as the interactive route: googleapis/Firestore
      // errors can carry project ids and quota details — logged, never
      // returned. One uid's failure must not stop the rest of the run.
      console.error(`[lexio/cron] send-reminders failed for uid ${uid}:`, err instanceof Error ? err.message : String(err));
      summary.failed++;
    }
  }

  return NextResponse.json(summary);
}
