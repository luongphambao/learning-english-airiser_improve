import { redirect } from 'next/navigation';

// /upload was the route for this flow before it became the Learn tab (Phase 2 —
// docs/decision.md ADR-013). Kept as a redirect stub so old links/bookmarks (incl.
// docs/README.md, if not yet updated) don't 404.
export default function UploadRedirectPage() {
  redirect('/learn');
}
