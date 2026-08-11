import { google } from 'googleapis';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'gmail_auth_tokens';

export function getOAuth2Client(origin?: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured.');
  }

  // Derive redirect URI dynamically or fallback to current origin
  const baseUrl = origin ? origin.replace(/\/+$/, '') : 'http://localhost:3000';
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
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export async function clearStoredTokens(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
