import { NextRequest, NextResponse } from 'next/server';
import { getOAuth2Client, resolveOrigin } from '@/lib/auth/google';

export async function GET(req: NextRequest) {
  const origin = resolveOrigin(req.nextUrl.origin);
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      const referer = req.headers.get('referer') || '';
      const returnPath = referer.includes('/settings') ? '/settings' : '/login';
      return NextResponse.redirect(
        new URL(`${returnPath}?gmail_error=config_missing`, origin)
      );
    }

    const oauth2Client = getOAuth2Client(origin);

    const scopes = [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ];

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: scopes,
    });

    return NextResponse.redirect(url);
  } catch (err) {
    console.error('Google OAuth Login error:', err);
    return NextResponse.redirect(new URL('/login?gmail_error=oauth_error', origin));
  }
}
