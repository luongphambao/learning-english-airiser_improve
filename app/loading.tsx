import { AppBootSkeleton } from '@/components/layout/app-boot-skeleton';

// Covers the root segment's first paint while its data/JS loads. Same shape as
// app/providers.tsx's boot skeleton so there's no visual jump between the two.
export default function RootLoading() {
  return <AppBootSkeleton />;
}
