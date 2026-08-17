import { NextResponse } from 'next/server';
import { clearStoredTokens } from '@/lib/auth/google';
import { getUserSession } from '@/lib/auth/user-session';
import { isAdminConfigured } from '@/lib/firebase/admin';
import { clearGmailTokensForUser } from '@/lib/reminders/store';

export async function POST() {
  await clearStoredTokens();

  // Mirrors the callback's write: disconnecting Gmail must also stop the
  // automated reminder cron from sending, not just clear the browser cookie.
  if (isAdminConfigured()) {
    const session = await getUserSession();
    if (session) {
      try {
        await clearGmailTokensForUser(session.uid);
      } catch (err) {
        console.error('[lexio/gmail] failed to clear server-side tokens:', err);
      }
    }
  }

  return NextResponse.json({ success: true });
}
