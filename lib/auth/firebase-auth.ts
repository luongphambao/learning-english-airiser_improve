'use client';

import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithRedirect,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase/client';

/**
 * Temporarily off: signInWithRedirect() reaches
 * `<authDomain>/__/auth/handler?...&providerId=google.com&...` (the standard,
 * correct Firebase redirect-flow URL) but doesn't come back with a session —
 * it's getting stuck/failing at that handler instead of bouncing on to
 * Google's consent screen. Smells like the OAuth client's Authorized
 * redirect URIs (Google Cloud Console > APIs & Services > Credentials, the
 * Web client tied to this Firebase project) don't include this authDomain's
 * handler URL, but that needs verifying against the actual project config
 * before re-enabling — see app/(stack)/login/page.tsx, which hides the
 * button entirely while this is false. Email/password sign-in is unaffected.
 */
export const GOOGLE_SIGNIN_ENABLED = false;

/** Vietnamese message for the auth error codes users actually hit — mirrors
 * the vocabulary in lib/api/problem.ts for AI-route errors. Unmapped codes
 * fall back to a generic message rather than leaking a raw Firebase code. */
export function describeAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code;
  switch (code) {
    case 'auth/invalid-email':
      return 'Địa chỉ email không hợp lệ.';
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'Email hoặc mật khẩu không đúng.';
    case 'auth/email-already-in-use':
      return 'Email này đã được đăng ký. Hãy đăng nhập thay vì tạo tài khoản mới.';
    case 'auth/weak-password':
      return 'Mật khẩu cần ít nhất 6 ký tự.';
    case 'auth/too-many-requests':
      return 'Bạn thử quá nhiều lần. Vui lòng đợi một lát rồi thử lại.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Đã huỷ đăng nhập Google.';
    case 'auth/unauthorized-domain':
      return 'Tên miền này chưa được cấp phép đăng nhập Google.';
    case 'auth/network-request-failed':
      return 'Lỗi kết nối. Vui lòng kiểm tra lại mạng.';
    default:
      return 'Đăng nhập thất bại. Vui lòng thử lại.';
  }
}

/** Exchanges the current Firebase ID token for this app's own session cookie
 * (app/api/auth/session/route.ts) — see that route's comment for why a
 * separate cookie exists. Best-effort: if the server has no Admin SDK
 * credentials configured (local dev, see .env.example), this fails quietly
 * and the caller keeps working off the client-side Firebase session alone. */
export async function establishServerSession(user: User): Promise<void> {
  try {
    const idToken = await user.getIdToken();
    await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
  } catch (err) {
    console.warn('[auth] establishServerSession failed (non-fatal):', err);
  }
}

/**
 * Starts Google sign-in via a full-page redirect to accounts.google.com,
 * rather than a popup. Popups are the unreliable choice in real browsers —
 * blocked outright by popup blockers, closed silently by ad blockers, and
 * increasingly broken by Chrome/Safari's third-party-cookie restrictions,
 * which `signInWithPopup` depends on to relay the result back. Redirect has
 * none of those failure modes: it's a normal top-level navigation.
 *
 * On success the browser navigates away immediately, so this only "returns"
 * by throwing (a config error before the redirect fires, e.g.
 * auth/unauthorized-domain). The actual sign-in is picked up after the
 * browser comes back, via completeGoogleRedirect().
 */
export async function signInWithGoogle(): Promise<void> {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  await signInWithRedirect(auth, provider);
}

/**
 * Call once on load (app/(stack)/login/page.tsx's mount effect) to pick up
 * the result of a signInWithGoogle() redirect. Resolves to null on an
 * ordinary page load that isn't a return from Google — the common case —
 * and only throws for a genuine sign-in failure (e.g. the Google account is
 * already linked to a different provider).
 */
export async function completeGoogleRedirect(): Promise<User | null> {
  const auth = getFirebaseAuth();
  const result = await getRedirectResult(auth);
  if (!result?.user) return null;
  await establishServerSession(result.user);
  return result.user;
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const auth = getFirebaseAuth();
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  await establishServerSession(user);
  return user;
}

export async function registerWithEmail(email: string, password: string, name?: string): Promise<User> {
  const auth = getFirebaseAuth();
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  if (name?.trim()) {
    await updateProfile(user, { displayName: name.trim() });
  }
  await establishServerSession(user);
  return user;
}

export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(getFirebaseAuth(), email);
}

/** Signs out of Firebase and clears the server session cookie — mirrors the
 * two-sided setUserSession()/establishServerSession() pair above. Does NOT
 * touch the separate Gmail-reminder OAuth connection (lib/auth/google.ts) —
 * that's an independent feature toggled from Settings, not tied to sign-in. */
export async function signOutEverywhere(): Promise<void> {
  await Promise.allSettled([
    signOut(getFirebaseAuth()),
    fetch('/api/auth/logout', { method: 'POST' }),
  ]);
}

export function subscribeAuthState(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(getFirebaseAuth(), callback);
}
