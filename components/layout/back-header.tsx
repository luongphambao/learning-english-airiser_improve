'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

interface BackHeaderProps {
  title: string;
}

// Header for pushed (stack) screens — Tiến độ, Cài đặt — reached from the gear/streak
// icons in AppHeader. No tab strip here (docs/architecture.md §4: (stack) group has
// no TabBar). router.back() falls back to /today if there is no history entry
// (deep-linking straight to /progress would otherwise have nowhere to go back to).
export function BackHeader({ title }: BackHeaderProps) {
  const router = useRouter();

  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push('/today');
  };

  return (
    <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-md border-b border-rule px-4 sm:px-8 h-16 flex items-center justify-between shrink-0 shadow-xs">
      <button
        onClick={goBack}
        className="p-2 -ml-2 rounded-xl text-ink-soft hover:bg-green-wash hover:text-ink transition-colors cursor-pointer"
        aria-label="Quay lại"
      >
        <ChevronLeft size={22} />
      </button>
      <span className="font-mono-utility text-xs text-ink-soft uppercase tracking-wide">{title}</span>
      <span className="w-9" aria-hidden="true" />
    </header>
  );
}
