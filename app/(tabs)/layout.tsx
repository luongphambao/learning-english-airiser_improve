import { AppHeader } from '@/components/layout/app-header';
import { TabBar } from '@/components/layout/tab-bar';

// Server component — persists across sibling tab navigations (Trang chủ/Học/Luyện
// tập/Sổ tay), so header + nav never unmount/remount on tab switch. Only
// AppHeader/TabBar themselves are 'use client'. See docs/architecture.md §4.
// `pb-nav` reserves space for TabBar's fixed bottom bar on mobile (0 at md+, where
// it becomes an inline strip instead) — see app/globals.css.
export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-paper text-ink flex flex-col font-sans transition-colors duration-200">
      <AppHeader />
      <TabBar />
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 md:p-8 pb-nav">{children}</main>
    </div>
  );
}
