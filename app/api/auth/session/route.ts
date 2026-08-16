import { NextRequest, NextResponse } from 'next/server';
import { isAllowedOrigin } from '@/lib/api/guards';
import { isAdminConfigured, getAdminAuth } from '@/lib/firebase/admin';
import { setUserSession } from '@/lib/auth/user-session';

/**
 * Mints this app's own session cookie from a verified Firebase ID token.
 *
 * Why a separate cookie at all, instead of trusting the Firebase client SDK's
 * own persistence: server components/routes (app/api/gmail/send-reminder,
 * lib/auth/user-session.ts consumers) need identity available without a
 * client round-trip, same as before this change — only the *source* of
 * truth changed, from a self-issued base64 blob to a token Firebase itself
 * signed.
 *
 * Called by lib/auth/firebase-auth.ts's establishServerSession() right after
 * every sign-in and on every auth-state change (app/providers.tsx), so the
 * cookie never drifts out of sync with the Firebase client session.
 */
export async function POST(req: NextRequest) {
  if (!isAllowedOrigin(req)) {
    return NextResponse.json({ error: 'forbidden_origin' }, { status: 403 });
  }

  if (!isAdminConfigured()) {
    // Local dev without a service-account key configured yet — degrade
    // instead of breaking sign-in entirely. Firebase Auth + Firestore sync
    // still work (they're client-side, governed by firestore.rules); only
    // server-side identity (e.g. the Gmail reminder route reading `uid`)
    // is unavailable until FIREBASE_ADMIN_* is set. See .env.example.
    return NextResponse.json(
      { error: 'admin_not_configured', message: 'Máy chủ chưa cấu hình Firebase Admin — xem .env.example.' },
      { status: 503 }
    );
  }

  let idToken: string;
  try {
    const body = await req.json();
    if (typeof body.idToken !== 'string' || !body.idToken) {
      return NextResponse.json({ error: 'missing_id_token' }, { status: 400 });
    }
    idToken = body.idToken;
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    if (!decoded.email) {
      return NextResponse.json(
        { error: 'no_email', message: 'Tài khoản không có email liên kết.' },
        { status: 400 }
      );
    }

    const loginMethod: 'email' | 'google' =
      decoded.firebase?.sign_in_provider === 'google.com' ? 'google' : 'email';

    await setUserSession({
      uid: decoded.uid,
      email: decoded.email,
      name: (decoded.name as string | undefined) || decoded.email.split('@')[0],
      loginMethod,
      createdAt: Date.now(),
    });

    return NextResponse.json({
      success: true,
      user: { uid: decoded.uid, email: decoded.email, name: decoded.name, loginMethod },
    });
  } catch (err) {
    console.error('[auth/session] verifyIdToken failed:', err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: 'invalid_token', message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' },
      { status: 401 }
    );
  }
}
