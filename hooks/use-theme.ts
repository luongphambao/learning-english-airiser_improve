'use client';

import { useEffect } from 'react';
import { useProfile } from './use-profile';
import { useSettingsStore } from '@/stores/settings-store';

/** Keeps the DOM `data-theme` attribute correct when the preference is 'system'
 * and the OS theme changes while the app is open (the layout.tsx init script only
 * handles first paint). Mount this once, high in the (tabs)/(stack) tree. */
export function useThemeSync() {
  const { settings } = useProfile();
  const syncThemeToDom = useSettingsStore((s) => s.syncThemeToDom);

  useEffect(() => {
    syncThemeToDom(settings.theme);
    if (settings.theme !== 'system' || typeof matchMedia === 'undefined') return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => syncThemeToDom(settings.theme);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [settings.theme, syncThemeToDom]);
}
