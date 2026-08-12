import { redirect } from 'next/navigation';

// Server component (no 'use client') — the old app/page.tsx marked the whole tree
// client at the root, shipping every screen + lib/grammarData + the seed words on
// first load regardless of which tab was active. Real routes now own that split.
export default function RootPage() {
  redirect('/today');
}
