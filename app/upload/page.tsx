import { redirect } from 'next/navigation';

// /upload was the route for this flow before it became the Learn tab (Phase 2 —
// docs/decision.md ADR-013). Kept as a redirect stub so old links/bookmarks (incl.
// docs/README.md, if not yet updated) don't 404. Points at the document-upload
// mode specifically (docs/decision.md ADR-021) since that's what "/upload" implies.
export default function UploadRedirectPage() {
  redirect('/learn?mode=doc');
}
