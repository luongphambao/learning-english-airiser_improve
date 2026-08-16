import { create } from 'zustand';
import { getRepos } from '@/lib/repositories';
import type { UserSettings } from '@/lib/domain';

function resolveDark(theme: UserSettings['theme']): boolean {
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyThemeToDom(theme: UserSettings['theme']) {
  if (typeof document === 'undefined') return;
  const dark = resolveDark(theme);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

function applyLocaleToDom(locale: UserSettings['locale']) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;
}

/** app/layout.tsx's pre-hydration script reads this exact `lexio_settings` key to
 * set `data-theme`/`lang` before first paint (avoiding a flash of the wrong
 * theme/language on reload). IndexedDB is async and can't be read before first
 * paint, so this plain localStorage write is the synchronous mirror that script
 * depends on — only the keys actually changing are written, merged into whatever
 * was mirrored before. */
function mirrorForFoucScript(patch: Partial<Pick<UserSettings, 'theme' | 'locale'>>) {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem('lexio_settings');
    const existing = raw ? JSON.parse(raw) : {};
    const safeExisting = typeof existing === 'object' && existing !== null && !Array.isArray(existing) ? existing : {};
    localStorage.setItem('lexio_settings', JSON.stringify({ ...safeExisting, ...patch }));
  } catch {
    // best-effort only — a failed mirror just means the next cold load may flash
  }
}

interface SettingsStoreState {
  updateSettings(patch: Partial<UserSettings>): Promise<UserSettings>;
  /** Re-applies the DOM theme attribute — call once on mount and whenever the OS
   * theme changes while the preference is 'system'. */
  syncThemeToDom(theme: UserSettings['theme']): void;
}

export const useSettingsStore = create<SettingsStoreState>()(() => ({
  async updateSettings(patch) {
    const settings = await getRepos().user.updateSettings(patch);
    if (patch.theme !== undefined) applyThemeToDom(settings.theme);
    if (patch.locale !== undefined) applyLocaleToDom(settings.locale);
    if (patch.theme !== undefined || patch.locale !== undefined) {
      mirrorForFoucScript({ theme: patch.theme, locale: patch.locale });
    }
    return settings;
  },

  syncThemeToDom(theme) {
    applyThemeToDom(theme);
  },
}));
