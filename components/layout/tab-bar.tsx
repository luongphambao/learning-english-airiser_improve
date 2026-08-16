'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, FileText, Dumbbell, Bookmark } from 'lucide-react';
import { useT } from '@/hooks/use-i18n';

// Bottom nav on mobile, inline strip under the header on desktop (docs/decision.md
// ADR-013 — the mockup IA is Home/Learn/Practice/Notebook, four user-goal-centric
// destinations replacing the old feature-centric Hôm nay/Ngữ pháp/Sổ từ/Lịch strip).
// `shortLabelKey` renders in the bottom bar (tight width budget at 360px);
// `labelKey` is the fuller desktop text. Grammar and Study Plan are no longer
// top-level tabs — they keep working routes, reached from Practice and Home
// respectively (see docs/decision.md ADR-013) — de-emphasized, not removed
// (strategy doc §33).
const TABS = [
  { href: '/today', shortLabelKey: 'tabBar.home', labelKey: 'tabBar.home', icon: Home },
  { href: '/learn', shortLabelKey: 'tabBar.learnShort', labelKey: 'tabBar.learnFull', icon: FileText },
  { href: '/practice', shortLabelKey: 'tabBar.practice', labelKey: 'tabBar.practice', icon: Dumbbell },
  { href: '/vocabulary', shortLabelKey: 'tabBar.notebook', labelKey: 'tabBar.notebook', icon: Bookmark },
] as const;

export function TabBar() {
  const pathname = usePathname();
  const { t } = useT();

  return (
    <>
      {/* Mobile: fixed bottom bar */}
      <nav
        aria-label={t('tabBar.nav')}
        className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-surface border-t border-rule flex pb-safe"
      >
        {TABS.map(({ href, shortLabelKey, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[56px] text-[11px] transition-colors ${
                active ? 'text-green font-medium' : 'text-ink-soft'
              }`}
            >
              <Icon size={20} />
              <span>{t(shortLabelKey)}</span>
            </Link>
          );
        })}
      </nav>

      {/* Desktop: inline strip under the header */}
      <div className="hidden md:block bg-surface border-b border-rule px-4">
        <div className="max-w-3xl mx-auto flex items-center gap-1">
          {TABS.map(({ href, labelKey, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`px-3.5 py-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
                  active ? 'border-green text-green' : 'border-transparent text-ink-soft hover:text-ink'
                }`}
              >
                <Icon size={16} />
                <span>{t(labelKey)}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
