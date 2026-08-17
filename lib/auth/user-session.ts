import { cookies } from 'next/headers';

const SESSION_COOKIE_NAME = 'lexio_user_session';

export interface UserSession {
  // Firebase Auth uid — the app's real identity key everywhere sync/Firestore
  // touches (lib/db/dexie.ts's per-user DB name, firestore.rules). Every
  // session is now minted from a verified Firebase ID token
  // (app/api/auth/session/route.ts), never from a client-supplied email —
  // that was the previous hole (see git history of email/login/route.ts,
  // now deleted).
  uid: string;
  email: string;
  name?: string;
  loginMethod: 'email' | 'google';
  createdAt: number;
}

export async function getUserSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE_NAME);
  if (!cookie?.value) return null;

  try {
    const data = JSON.parse(Buffer.from(cookie.value, 'base64').toString('utf-8'));
    // Reject cookies minted before `uid` existed (pre-Firebase-Auth sessions,
    // or the old forgeable email/login route) instead of trusting a session
    // with no real identity attached.
    if (!data || typeof data.uid !== 'string' || !data.uid) return null;
    return data as UserSession;
  } catch {
    return null;
  }
}

export async function setUserSession(session: UserSession): Promise<void> {
  const cookieStore = await cookies();
  const serialized = Buffer.from(JSON.stringify(session)).toString('base64');

  cookieStore.set(SESSION_COOKIE_NAME, serialized, {
    httpOnly: true,
    // httpOnly stops JavaScript reading the cookie; it does nothing to stop the
    // cookie travelling over plain HTTP. Off in dev so `next dev` on http:// works.
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export async function clearUserSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
