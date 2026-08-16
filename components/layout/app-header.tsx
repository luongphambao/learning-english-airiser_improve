'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useProfile } from '@/hooks/use-profile';
import { useSettingsStore } from '@/stores/settings-store';
import { useT } from '@/hooks/use-i18n';
import { Flame, Sun, Moon, Settings, User, Languages } from 'lucide-react';

export function AppHeader() {
  const { stats, settings } = useProfile();
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const { t, locale, toggleLocale } = useT();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadUser = () => {
      fetch('/api/auth/me')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (active) {
            if (data?.authenticated && data?.user?.email) {
              setUserEmail(data.user.email);
            } else {
              setUserEmail(null);
            }
          }
        })
        .catch(() => {});
    };

    loadUser();
    window.addEventListener('lexio-auth-changed', loadUser);
    return () => {
      active = false;
      window.removeEventListener('lexio-auth-changed', loadUser);
    };
  }, []);

  const toggleTheme = () => {
    const nextTheme = settings.theme === 'dark' ? 'light' : 'dark';
    updateSettings({ theme: nextTheme });
  };

  return (
      <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-md border-b border-rule px-4 sm:px-8 h-16 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-green text-paper rounded-xl flex items-center justify-center font-serif-display text-lg">
            L
          </div>
          <span className="font-serif-display text-xl text-ink">Lexio</span>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/progress"
            className="flex items-center gap-2 bg-amber/10 px-3 py-1.5 rounded-full border border-amber/30 cursor-pointer hover:scale-105 transition-all"
            title={t('appHeader.streakLabel')}
          >
            <Flame size={16} className="text-amber fill-amber" />
            <span className="text-xs sm:text-sm font-semibold text-amber-ink font-mono-utility">
              {t('appHeader.streakDays', { count: stats.streak })}
            </span>
          </Link>

          <button
            onClick={toggleLocale}
            className="px-2 h-9 rounded-xl text-ink-soft hover:bg-green-wash hover:text-ink transition-colors cursor-pointer flex items-center gap-1"
            aria-label={t('common.toggleLanguage')}
            title={t('common.toggleLanguage')}
          >
            <Languages size={18} />
            <span className="text-[11px] font-mono-utility uppercase">{locale}</span>
          </button>

          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-ink-soft hover:bg-green-wash hover:text-ink transition-colors cursor-pointer"
            aria-label={t('appHeader.toggleTheme')}
          >
            {settings.theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          <Link
            href="/login"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all text-xs cursor-pointer ${
              userEmail
                ? 'bg-green-wash border-green/30 text-green font-medium'
                : 'border-rule text-ink-soft hover:text-ink hover:border-ink-soft/40'
            }`}
            title={userEmail ? t('appHeader.loggedInAs', { email: userEmail }) : t('appHeader.loginWithEmail')}
          >
            <User size={16} />
            <span className="hidden sm:inline truncate max-w-[100px] font-mono-utility">
              {userEmail ? userEmail.split('@')[0] : t('common.login')}
            </span>
          </Link>

          <Link
            href="/settings"
            className="p-2 rounded-xl text-ink-soft hover:bg-green-wash hover:text-ink transition-colors cursor-pointer"
            aria-label={t('common.settings')}
          >
            <Settings size={20} />
          </Link>
        </div>
      </header>
  );
}
