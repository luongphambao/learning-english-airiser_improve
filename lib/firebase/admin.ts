import 'server-only';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { FIRESTORE_DATABASE_ID } from './config';

/**
 * Admin SDK — used for exactly one thing: verifying a Firebase ID token to
 * mint the app's own session cookie (app/api/auth/session/route.ts). All
 * other Firestore access is client-side, governed by firestore.rules — the
 * client never needs Admin credentials to sync.
 *
 * Credentials are OPTIONAL:
 * - Cloud Run: no FIREBASE_ADMIN_* env vars needed. Its service account is in
 *   the same project, so `initializeApp()` with no args picks up Application
 *   Default Credentials automatically.
 * - Local dev: FIREBASE_ADMIN_CLIENT_EMAIL / FIREBASE_ADMIN_PRIVATE_KEY from
 *   a downloaded service-account key (see docs — Project settings > Service
 *   accounts > Generate new private key). If absent, isAdminConfigured()
 *   returns false and callers degrade instead of throwing (see
 *   app/api/auth/session/route.ts).
 */

let app: App | null = null;
let initAttempted = false;

function getAdminApp(): App | null {
  if (app || initAttempted) return app;
  initAttempted = true;

  if (getApps().length) {
    app = getApps()[0]!;
    return app;
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  try {
    if (clientEmail && privateKey && projectId) {
      app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
    } else if (process.env.K_SERVICE || process.env.GOOGLE_CLOUD_PROJECT) {
      // Running on Cloud Run (K_SERVICE is set by the Cloud Run runtime) —
      // Application Default Credentials from the attached service account.
      app = initializeApp();
    } else {
      // Local dev with no service-account key configured yet — not an error,
      // just "Admin SDK unavailable". See isAdminConfigured().
      return null;
    }
  } catch (err) {
    console.error('[firebase-admin] init failed:', err);
    return null;
  }
  return app;
}

export function isAdminConfigured(): boolean {
  return getAdminApp() !== null;
}

export function getAdminAuth(): Auth {
  const a = getAdminApp();
  if (!a) throw new Error('Firebase Admin not configured — see lib/firebase/admin.ts');
  return getAuth(a);
}

export function getAdminFirestore(): Firestore {
  const a = getAdminApp();
  if (!a) throw new Error('Firebase Admin not configured — see lib/firebase/admin.ts');
  return getFirestore(a, FIRESTORE_DATABASE_ID);
}
