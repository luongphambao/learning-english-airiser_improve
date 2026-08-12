'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, BookCheck, Bookmark, Calendar } from 'lucide-react';

// Same horizontal tab strip AppShell used to render under the header (this app's
// nav is a top strip, not the mockup's bottom bar — see docs/decision.md ADR-006:
// the AI-Studio look is kept as-is). Active state now comes from the URL instead of
// a `useState<TabType>`, so each tab is a real, deep-linkable, bookmarkable route.
const TABS = [
  { href: '/today', label: 'Hôm nay', icon: BookOpen },
  { href: '/grammar', label: 'Ngữ pháp', icon: BookCheck },
  { href: '/vocabulary', label: 'Sổ từ', icon: Bookmark },
  { href: '/calendar', label: 'Lịch học', icon: Calendar },
] as const;

export function TabBar() {
  const pathname = usePathname();

  return (
    <div className="bg-surface border-b border-rule px-4 overflow-x-auto">
      <div className="max-w-4xl mx-auto flex items-center justify-center sm:justify-start gap-1 sm:gap-2 py-2">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer flex items-center gap-2 ${
                active
                  ? 'bg-green text-white shadow-xs'
                  : 'text-ink-soft hover:bg-paper hover:text-ink'
              }`}
            >
              <Icon size={16} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
