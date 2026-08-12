import { google } from 'googleapis';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'gmail_auth_tokens';

/**
 * Canonical origin for anything OAuth-adjacent — the redirect_uri sent to
 * Google below, AND every redirect the two route handlers send the browser to
 * after the flow finishes (success/error back to /settings or /login).
 *
 * Prefers the operator-configured APP_URL over the incoming request's Host
 * header. On Cloud Run (and any deployment where APP_URL is set), trusting
 * the request's origin is fragile — a proxy/Host-header quirk can produce a
 * wrong URL Google's OAuth client never has registered, or one the browser
 * can't even reach (observed in production: origin resolving to
 * https://0.0.0.0:3000 / https://localhost:3000 on Cloud Run requests that
 * never touched either host). APP_URL is normally unset in local dev, so this
 * falls back to the request's own origin there — still normalized for
 * `next dev`'s `-H 0.0.0.0` bind, since Google's OAuth client only ever has
 * http://localhost:3000/... registered for local dev.
 */
export function resolveOrigin(requestOrigin?: string): string {
  const configuredAppUrl = process.env.APP_URL;
  const rawBaseUrl = configuredAppUrl
    ? configuredAppUrl.replace(/\/+$/, '')
    : requestOrigin
      ? requestOrigin.replace(/\/+$/, '')
      : 'http://localhost:3000';
  return rawBaseUrl.replace(/^(https?:\/\/)0\.0\.0\.0(:\d+)?$/, '$1localhost$2');
}

export function getOAuth2Client(origin?: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured.');
  }

  const redirectUri = `${resolveOrigin(origin)}/api/auth/google/callback`;

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
