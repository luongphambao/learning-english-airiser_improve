// Server component — no AppHeader/TabBar here, matching docs/architecture.md §4
// ((stack) group = pushed sub-screens with a back affordance, no tab bar). Each page
// renders its own <BackHeader title="..."/> since the title differs per route and a
// shared layout has no clean way to receive it from the page below.
export default function StackLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-paper text-ink flex flex-col font-sans transition-colors duration-200">
      {/* Same reasoning as app/(tabs)/layout.tsx: a fixed 4xl left a 1280px screen
          mostly empty. Progress (a 7-day chart plus a 4-tile stat row) and the
          leaderboard both read better with the extra width; pages that must stay a
          narrow column set their own (placement is `max-w-md mx-auto`). */}
      <main className="flex-1 max-w-4xl lg:max-w-5xl w-full mx-auto p-4 sm:p-6 md:p-8">{children}</main>
    </div>
  );
}
