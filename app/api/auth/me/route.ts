import { NextResponse } from 'next/server';
import { getUserSession } from '@/lib/auth/user-session';
import { getStoredTokens } from '@/lib/auth/google';

export async function GET() {
  const session = await getUserSession();
  const googleTokens = await getStoredTokens();

  if (session) {
    return NextResponse.json({
      authenticated: true,
      user: {
        uid: session.uid,
        email: session.email,
        name: session.name || session.email.split('@')[0],
        loginMethod: session.loginMethod,
      },
      gmailConnected: !!(googleTokens?.access_token || googleTokens?.refresh_token),
      gmailEmail: googleTokens?.email,
    });
  }

  // No sign-in fallback on Gmail connection alone: connecting Gmail for the
  // reminder feature (lib/auth/google.ts) is deliberately independent of
  // sign-in (lib/auth/firebase-auth.ts) — see app/api/auth/google/callback's
  // comment. Reporting `gmailConnected` here even when signed out lets
  // Settings still show "Gmail connected" without pretending that's a login.
  return NextResponse.json({
    authenticated: false,
    user: null,
    gmailConnected: !!(googleTokens?.access_token || googleTokens?.refresh_token),
    gmailEmail: googleTokens?.email,
  });
}
