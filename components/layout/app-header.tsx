'use client';

import Link from 'next/link';
import { useProfile } from '@/hooks/use-profile';
import { useSettingsStore } from '@/stores/settings-store';
import { Flame, Sun, Moon, Settings } from 'lucide-react';

// Ported verbatim from the old components/AppShell.tsx header (same markup/classes,
// same behaviour). Navigation moved from local useState to real routes in Phase 2;
// data source moved from context/WordsContext.tsx to the Dexie-backed profile
// hook + settings store in Phase 5 (docs/architecture.md §4/§7).
export function AppHeader() {
  const { stats, settings } = useProfile();
  const updateSettings = useSettingsStore((s) => s.updateSettings);

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

        <div className="flex items-center gap-3 sm:gap-6">
          <Link
            href="/tien-do"
            className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 rounded-full border border-amber-200/60 dark:border-amber-800/50 cursor-pointer hover:scale-105 transition-all"
            title="Xem tiến độ chuỗi ngày"
          >
            <Flame size={16} className="text-amber-500 fill-amber-500" />
            <span className="text-xs sm:text-sm font-semibold text-amber-700 dark:text-amber-400 font-mono-utility">
              {stats.streak} ngày liên tiếp
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
