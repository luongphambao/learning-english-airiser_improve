/**
 * Firebase web config — committed as a plain module, NOT read from
 * NEXT_PUBLIC_* env vars.
 *
 * Why not env: Dockerfile deliberately supplies every env var this app reads
 * at `docker run` time (see Dockerfile's header comment — "there are no
 * NEXT_PUBLIC_* vars in this repo" is an invariant the whole build pipeline
 * relies on). NEXT_PUBLIC_* vars are inlined by Next.js at *build* time, not
 * request time, so introducing one here would silently break on Cloud Run
 * (build-time env ≠ run-time env in this pipeline) while working fine in
 * local dev — exactly the class of bug that's hardest to catch before prod.
 *
 * This is safe to commit: a Firebase web apiKey is not a secret (it ships in
 * the JS bundle of every Firebase web app); access control is enforced by
 * Firestore security rules (firestore.rules) and Firebase Auth's authorized
 * domains list, not by hiding this object. Previously lived as
 * firebase-applet-config.json (an AI Studio artifact, unused by any code) —
 * that file is now deleted and this module is the one source of truth.
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyCJgTWRLgnARTbkGhzGHID6n7hcOlfIwJw',
  authDomain: 'gen-lang-client-0567465169.firebaseapp.com',
  projectId: 'gen-lang-client-0567465169',
  storageBucket: 'gen-lang-client-0567465169.firebasestorage.app',
  messagingSenderId: '370616158892',
  appId: '1:370616158892:web:5434c4bd7a8608c3a9ed09',
} as const;

/**
 * Firestore in this project is a named database (an AI Studio artifact), not
 * the `(default)` database — every Firestore client (both web SDK here and
 * firebase-admin in lib/firebase/admin.ts) must pass this id explicitly, or
 * it silently talks to a `(default)` database that doesn't exist (404s on
 * everything). See docs/data-model.md §5 and firebase.json.
 */
export const FIRESTORE_DATABASE_ID = 'ai-studio-learningenglisha-1126a34d-2561-404c-bb10-3c8edf34d69f';
