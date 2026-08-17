import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getOAuth2Client, resolveOrigin, setStoredTokens } from '@/lib/auth/google';
import { getUserSession } from '@/lib/auth/user-session';
import { isAdminConfigured } from '@/lib/firebase/admin';
import { setGmailTokensForUser } from '@/lib/reminders/store';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const error = req.nextUrl.searchParams.get('error');
  const origin = resolveOrigin(req.nextUrl.origin);

  if (error) {
    return NextResponse.redirect(new URL('/settings?gmail_error=' + encodeURIComponent(error), origin));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/settings?gmail_error=missing_code', origin));
  }

  try {
    const oauth2Client = getOAuth2Client(origin);

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    let userEmail = '';
    try {
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      userEmail = userInfo.data.email || '';
    } catch {
      // Fallback: try reading Gmail profile
      try {
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
        const profile = await gmail.users.getProfile({ userId: 'me' });
        userEmail = profile.data.emailAddress || '';
      } catch {
        userEmail = 'Gmail User';
      }
    }

    await setStoredTokens({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
      email: userEmail,
    });

    // This flow only connects Gmail for the reminder feature (setStoredTokens
    // above) — it deliberately does NOT call setUserSession(). Doing so used
    // to sign the browser in as `userEmail` on Google's say-so alone, with no
    // Firebase ID token verification; that's a separate identity claim from
    // the app's real sign-in (lib/auth/firebase-auth.ts) and conflating them
    // let connecting Gmail silently log you in as whoever's Gmail you linked.

    // Additionally persist the same tokens server-side, keyed by the
    // signed-in Firebase uid — the automated reminder cron (no browser, no
    // cookie jar) reads from there, not from the cookie above. Only when a
    // real Firebase session already exists: a guest (no uid) can still use
    // the interactive "send test email" button via the cookie, but has no
    // account for a cron job to attach an automated schedule to. See
    // docs/decision.md ADR-027.
    if (isAdminConfigured()) {
      const session = await getUserSession();
      if (session) {
        try {
          // Admin Firestore rejects `undefined` field values outright (unlike
          // the client SDK), so every optional googleapis field is coalesced
          // to `null` first.
          await setGmailTokensForUser(session.uid, {
            access_token: tokens.access_token ?? null,
            refresh_token: tokens.refresh_token ?? null,
            expiry_date: tokens.expiry_date ?? null,
            email: userEmail,
          });
        } catch (err) {
          // Automated reminders degrade to "not scheduled" — the interactive
          // path above already succeeded, so this must not fail the request.
          console.error('[lexio/gmail] failed to persist server-side tokens:', err);
        }
      }
    }

    return NextResponse.redirect(new URL('/settings?gmail=connected', origin));
  } catch (err) {
    console.error('OAuth callback error:', err instanceof Error ? err.message : String(err));
    return NextResponse.redirect(new URL('/settings?gmail_error=auth_failed', origin));
  }
}
