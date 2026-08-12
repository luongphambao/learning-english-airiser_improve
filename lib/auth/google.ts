import { google } from 'googleapis';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'gmail_auth_tokens';

export function getOAuth2Client(origin?: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured.');
  }

  // Derive redirect URI dynamically or fallback to current origin. `next dev` in
  // this repo binds `-H 0.0.0.0` so the app is reachable at http(s)://0.0.0.0:3000 —
  // but Google's OAuth client only ever has http://localhost:3000/... registered
  // as an authorized redirect URI, so a request whose Host header is 0.0.0.0 must
  // still redirect back to localhost or the consent screen 400s.
  const rawBaseUrl = origin ? origin.replace(/\/+$/, '') : 'http://localhost:3000';
  const baseUrl = rawBaseUrl.replace(/^(https?:\/\/)0\.0\.0\.0(:\d+)?$/, '$1localhost$2');
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export interface StoredTokens {
  access_token?: string | null;
  refresh_token?: string | null;
  expiry_date?: number | null;
  email?: string;
}

export async function getStoredTokens(): Promise<StoredTokens | null> {
  const cookieStore = await cookies();
  const tokenCookie = cookieStore.get(COOKIE_NAME);
  if (!tokenCookie?.value) return null;

  try {
    const data = JSON.parse(Buffer.from(tokenCookie.value, 'base64').toString('utf-8'));
    return data;
  } catch {
    return null;
  }
}

export async function setStoredTokens(tokens: StoredTokens): Promise<void> {
  const cookieStore = await cookies();
  const serialized = Buffer.from(JSON.stringify(tokens)).toString('base64');
  
  cookieStore.set(COOKIE_NAME, serialized, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export async function clearStoredTokens(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
