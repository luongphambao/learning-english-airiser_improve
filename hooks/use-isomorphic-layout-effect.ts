'use client';

import { useEffect, useLayoutEffect } from 'react';

/**
 * useLayoutEffect in the browser, useEffect during SSR (where React warns that
 * useLayoutEffect does nothing on the server).
 *
 * Used for the "a finished flow must not survive a tab switch" resets in
 * app/(tabs)/learn/page.tsx and app/(tabs)/practice/page.tsx: those stores are
 * module-level zustand singletons, so a page that remounts can find one still
 * holding the terminal state from the previous visit. Resetting in a plain
 * useEffect works but runs AFTER paint — the user sees one frame of the stale
 * result screen before it's replaced. A layout effect runs before paint, so the
 * page's first visible frame is already the correct one.
 */
export const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;
