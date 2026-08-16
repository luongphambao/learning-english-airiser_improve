'use client';

import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { firebaseConfig, FIRESTORE_DATABASE_ID } from './config';

// Lazy singletons, same pattern as lib/db/dexie.ts's getDb() — Next.js can
// import client modules during server-side render (e.g. for type-checking a
// page tree), so this must not run Firebase SDK init at module load, only on
// first call from client code.
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let firestore: Firestore | null = null;

function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
  }
  return auth;
}

/** Points at the named database (see FIRESTORE_DATABASE_ID) — never the
 * `(default)` database, which doesn't exist in this project. */
export function getFirebaseFirestore(): Firestore {
  if (!firestore) {
    firestore = getFirestore(getFirebaseApp(), FIRESTORE_DATABASE_ID);
  }
  return firestore;
}
