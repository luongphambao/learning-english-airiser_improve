// Server component — no AppHeader/TabBar here, matching docs/architecture.md §4
// ((stack) group = pushed sub-screens with a back affordance, no tab bar). Each page
// renders its own <BackHeader title="..."/> since the title differs per route and a
// shared layout has no clean way to receive it from the page below.
export default function StackLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-paper text-ink flex flex-col font-sans transition-colors duration-200">
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 md:p-8">{children}</main>
    </div>
  );
}
