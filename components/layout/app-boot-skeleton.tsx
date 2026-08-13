// Shown while app/providers.tsx runs the one-time localStorage migration + seed
// (typically fast, but a genuine blank screen otherwise — no route-level
// loading.tsx can reach this, since Providers is a client component already
// mounted inside the rendered layout by the time this runs). Sized to roughly
// match the app shell + Home's first cards so hand-off has minimal layout shift.
export function AppBootSkeleton() {
  return (
    <div className="min-h-dvh bg-paper flex flex-col">
      <div className="h-16 border-b border-rule bg-surface shrink-0" />
      <div className="hidden md:block h-12 border-b border-rule bg-surface shrink-0" />
      <div className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 md:p-8 space-y-4">
        <div className="h-8 w-40 rounded bg-rule/60 animate-pulse" />
        <div className="h-4 w-64 rounded bg-rule/40 animate-pulse" />
        <div className="h-32 rounded-card bg-rule/30 animate-pulse mt-6" />
        <div className="h-40 rounded-card bg-rule/30 animate-pulse" />
      </div>
      <div className="md:hidden h-[60px] border-t border-rule bg-surface shrink-0" />
    </div>
  );
}
