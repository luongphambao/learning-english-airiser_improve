// (stack) pages render their own <BackHeader title="..."/> inside the page itself
// (docs/architecture.md §4 — a shared layout has no clean way to receive a
// per-route title), so without this the header pops in once the page component
// mounts. This mimics its exact height or the header animates in a moment late.
export default function StackLoading() {
  return (
    <div className="min-h-dvh flex flex-col" aria-hidden="true">
      <div className="h-16 border-b border-rule bg-surface shrink-0" />
      <div className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 md:p-8 space-y-3">
        <div className="h-6 w-32 rounded bg-rule/60 animate-pulse" />
        <div className="h-20 rounded-card bg-rule/30 animate-pulse" />
        <div className="h-20 rounded-card bg-rule/30 animate-pulse" />
        <div className="h-20 rounded-card bg-rule/30 animate-pulse" />
      </div>
    </div>
  );
}
