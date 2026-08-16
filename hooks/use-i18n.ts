'use client';

import { useCallback, useMemo } from 'react';
import { useProfile } from './use-profile';
import { useSettingsStore } from '@/stores/settings-store';
import { translate } from '@/lib/i18n/translate';
import type { Locale } from '@/lib/domain';

/** Reads the current UI language from settings (same source as `theme` —
 * hooks/use-profile.ts) and returns a `t()` bound to it, mirroring the
 * `toggleTheme` pattern in components/layout/app-header.tsx: both go through
 * `useSettingsStore().updateSettings()`, the single write path for `UserSettings`. */
export function useT() {
  const { settings } = useProfile();
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const locale = settings.locale;

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale],
  );

  const setLocale = useCallback(
    (next: Locale) => updateSettings({ locale: next }),
    [updateSettings],
  );

  const toggleLocale = useCallback(() => setLocale(locale === 'vi' ? 'en' : 'vi'), [locale, setLocale]);

  return useMemo(() => ({ t, locale, setLocale, toggleLocale }), [t, locale, setLocale, toggleLocale]);
}
