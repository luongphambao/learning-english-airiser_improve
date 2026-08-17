'use client';

import { createContext, useContext } from 'react';

/** `guest` is the "try it without an account" mode entered from the login screen
 * (lib/auth/guest.ts). `account` covers both a live Firebase session and a
 * server session cookie without one. */
export type AccessMode = 'account' | 'guest';

const AccessContext = createContext<AccessMode>('account');

export const AccessProvider = AccessContext.Provider;

export function useAccessMode(): AccessMode {
  return useContext(AccessContext);
}

/** True for visitors with no account: no leaderboard, no document upload, no sync. */
export function useIsGuest(): boolean {
  return useAccessMode() === 'guest';
}
