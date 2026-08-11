import { cookies } from 'next/headers';

const SESSION_COOKIE_NAME = 'lexio_user_session';

export interface UserSession {
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
    return data;
  } catch {
    return null;
  }
}

export async function setUserSession(session: UserSession): Promise<void> {
  const cookieStore = await cookies();
  const serialized = Buffer.from(JSON.stringify(session)).toString('base64');

  cookieStore.set(SESSION_COOKIE_NAME, serialized, {
    httpOnly: true,
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
