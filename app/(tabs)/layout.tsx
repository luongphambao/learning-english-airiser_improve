import { AppHeader } from '@/components/layout/app-header';
import { TabBar } from '@/components/layout/tab-bar';

// Server component — persists across sibling tab navigations (Hôm nay/Ngữ pháp/Sổ
// từ/Lịch), so header + tab strip never unmount/remount on tab switch. Only
// AppHeader/TabBar themselves are 'use client'. See docs/architecture.md §4.
export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-paper text-ink flex flex-col font-sans transition-colors duration-200">
      <AppHeader />
      <TabBar />
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 md:p-8">{children}</main>
    </div>
  );
}
