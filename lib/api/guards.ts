import 'server-only';
import type { NextRequest } from 'next/server';
import { getAppUrl } from '@/lib/ai/config';

/**
 * No accounts exist yet in this pass, so origin + size + rate limit are the whole
 * defence (docs/api_document.md §0 / docs/decision.md). `Sec-Fetch-Site` is set by
 * every modern browser on same-origin fetch() calls and cannot be forged by
 * script; a request missing it AND missing a matching Origin header is rejected.
 */
export function isAllowedOrigin(req: NextRequest): boolean {
  const secFetchSite = req.headers.get('sec-fetch-site');
  if (secFetchSite === 'same-origin' || secFetchSite === 'same-site') return true;

  const origin = req.headers.get('origin');
  if (!origin) return secFetchSite === null; // same-origin requests from older clients omit both
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
