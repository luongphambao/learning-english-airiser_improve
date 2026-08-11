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
        email: session.email,
        name: session.name || session.email.split('@')[0],
        loginMethod: session.loginMethod,
      },
      gmailConnected: !!(googleTokens?.access_token || googleTokens?.refresh_token),
      gmailEmail: googleTokens?.email,
    });
  }

  if (googleTokens?.email) {
    return NextResponse.json({
      authenticated: true,
      user: {
        email: googleTokens.email,
        name: googleTokens.email.split('@')[0],
        loginMethod: 'google',
      },
      gmailConnected: true,
      gmailEmail: googleTokens.email,
    });
  }

  return NextResponse.json({
    authenticated: false,
    user: null,
    gmailConnected: false,
  });
}
