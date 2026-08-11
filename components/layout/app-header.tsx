'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useProfile } from '@/hooks/use-profile';
import { useSettingsStore } from '@/stores/settings-store';
import { Flame, Sun, Moon, Settings, User } from 'lucide-react';

export function AppHeader() {
  const { stats, settings } = useProfile();
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.authenticated && data?.user?.email) {
          setUserEmail(data.user.email);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const toggleTheme = () => {
    const nextTheme = settings.theme === 'dark' ? 'light' : 'dark';
    updateSettings({ theme: nextTheme });
  };

  return (
      <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-md border-b border-rule px-4 sm:px-8 h-16 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-bold text-lg shadow-sm shadow-indigo-200 dark:shadow-none">
            L
          </div>
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-500">
            Lexio
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/tien-do"
            className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 rounded-full border border-amber-200/60 dark:border-amber-800/50 cursor-pointer hover:scale-105 transition-all"
            title="Xem tiến độ chuỗi ngày"
          >
            <Flame size={16} className="text-amber-500 fill-amber-500" />
            <span className="text-xs sm:text-sm font-semibold text-amber-700 dark:text-amber-400 font-mono-utility">
              {stats.streak} ngày
            </span>
          </Link>

          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-ink-soft hover:bg-green-wash hover:text-ink transition-colors cursor-pointer"
            aria-label="Chuyển đổi giao diện sáng/tối"
          >
            {settings.theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          <Link
            href="/dang-nhap"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all text-xs cursor-pointer ${
              userEmail
                ? 'bg-green-wash border-green/30 text-green font-medium'
                : 'border-rule text-ink-soft hover:text-ink hover:border-ink-soft/40'
            }`}
            title={userEmail ? `Đã đăng nhập: ${userEmail}` : 'Đăng nhập với email'}
          >
            <User size={16} />
            <span className="hidden sm:inline truncate max-w-[100px] font-mono-utility">
              {userEmail ? userEmail.split('@')[0] : 'Đăng nhập'}
            </span>
          </Link>

          <Link
            href="/cai-dat"
            className="p-2 rounded-xl text-ink-soft hover:bg-green-wash hover:text-ink transition-colors cursor-pointer"
            aria-label="Cài đặt"
          >
            <Settings size={20} />
          </Link>
        </div>
      </header>
  );
}
