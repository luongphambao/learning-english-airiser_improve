import { AppHeader } from '@/components/layout/app-header';
import { TabBar } from '@/components/layout/tab-bar';

// Server component — persists across sibling tab navigations (Trang chủ/Học/Luyện
// tập/Sổ tay), so header + nav never unmount/remount on tab switch. Only
// AppHeader/TabBar themselves are 'use client'. See docs/architecture.md §4.
// `pb-nav` reserves space for TabBar's fixed bottom bar on mobile (0 at md+, where
// it becomes an inline strip instead) — see app/globals.css.
//
// Width: `max-w-3xl` up to lg, `max-w-5xl` above it. The old fixed 3xl meant a
// 1280px screen rendered a phone-width column with ~256px of dead space on each
// side, which is what a desktop visitor sees first. Widening is safe for every tab
// because the content that MUST stay narrow constrains itself rather than
// inheriting the shell's width: all four exercise components are
// `max-w-md`/`max-w-lg mx-auto`, and Home opts into a real two-column layout at the
// same lg breakpoint (app/(tabs)/today/page.tsx).
export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-paper text-ink flex flex-col font-sans transition-colors duration-200">
      <AppHeader />
      <TabBar />
      <main className="flex-1 max-w-3xl lg:max-w-5xl w-full mx-auto p-4 sm:p-6 md:p-8 pb-nav">{children}</main>
    </div>
  );
}
