// Header + nav are already painted by app/(tabs)/layout.tsx (a server component
// that persists across sibling tab navigations) — this only needs to fill the
// content area while a tab's own data/JS loads.
export default function TabsLoading() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="h-8 w-40 rounded bg-rule/60 animate-pulse" />
      <div className="h-4 w-64 rounded bg-rule/40 animate-pulse" />
      <div className="h-32 rounded-card bg-rule/30 animate-pulse mt-6" />
      <div className="h-40 rounded-card bg-rule/30 animate-pulse" />
    </div>
  );
}
