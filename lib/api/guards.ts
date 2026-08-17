import 'server-only';
import type { NextRequest } from 'next/server';
import { getAppUrl } from '@/lib/ai/config';

/**
 * First layer of the API defence, ahead of size cap, zod validation, rate limit
 * and (for the costly tasks) a session check — docs/api_document.md §0.
 *
 * `Sec-Fetch-Site` is set by every modern browser on fetch() and cannot be forged
 * by script. A request carrying neither it nor a matching `Origin` is not a
 * browser request at all — curl and every scripted client land there — so it is
 * rejected rather than allowed. This used to `return secFetchSite === null`,
 * which made the whole guard a no-op for anything that wasn't a browser.
 */
export function isAllowedOrigin(req: NextRequest): boolean {
  const secFetchSite = req.headers.get('sec-fetch-site');
  if (secFetchSite === 'same-origin' || secFetchSite === 'same-site') return true;

  const origin = req.headers.get('origin');
  if (!origin) return false;
  const allowed = new Set([getAppUrl(), 'http://localhost:3000']);
  return allowed.has(origin);
}

export function contentLengthExceeds(req: NextRequest, maxBytes: number): boolean {
  const header = req.headers.get('content-length');
  if (!header) return false; // a lying/absent header is caught by the streaming read in create-ai-route.ts
  const declared = Number(header);
  return Number.isFinite(declared) && declared > maxBytes;
}

export async function readBodyWithCap(req: NextRequest, maxBytes: number): Promise<{ ok: true; text: string } | { ok: false }> {
  const buf = await req.arrayBuffer();
  if (buf.byteLength > maxBytes) return { ok: false };
  return { ok: true, text: new TextDecoder().decode(buf) };
}
