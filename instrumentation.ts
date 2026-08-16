/**
 * Next.js calls register() once while bootstrapping a server instance, before route
 * modules are evaluated — which is the only window that fixes the Cloud Run failure
 * "[lexio/parse-doc] failed: DOMMatrix is not defined".
 *
 * pdfjs 6.x runs `const SCALE_MATRIX = new DOMMatrix()` at the top level of
 * legacy/build/pdf.mjs, so merely importing it throws on a runtime without that
 * browser global. It tries to self-polyfill from its optional `@napi-rs/canvas`
 * dependency through `createRequire(import.meta.url)`, but that dynamic require is
 * invisible to Next's dependency tracing, so the package never reaches
 * `.next/standalone` and every PDF upload failed in the container while working
 * locally against the full node_modules tree.
 *
 * Polyfilling inside the upload handler is too late: the standalone server evaluates
 * `app/api/parse-doc/route.ts` — and with it pdf.mjs — at boot, before the first
 * request arrives. Verified by watching a built server log the pdfjs warnings between
 * "Ready" and any traffic. lib/documents/extract.server.ts keeps its own guard for
 * contexts that never run instrumentation, such as vitest.
 *
 * The geometry submodule, not the package root, is deliberate: it is pure JS (~30KB,
 * `util` its only dependency) and bundles cleanly, while the root pulls in a ~27MB
 * native Skia binary this server has no use for — it extracts text and never
 * rasterizes. Path2D is skipped for the same reason; pdfjs only needs it to render and
 * merely warns when it is absent.
 */
export async function register() {
  // The edge runtime has DOMMatrix already and cannot load this CommonJS module.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (typeof globalThis.DOMMatrix !== 'undefined') return;

  // geometry.js is CommonJS, and webpack's interop exposes `module.exports` under
  // `default` rather than as named exports — reading only the named one silently
  // assigns undefined, which looks exactly like no polyfill at all.
  const geometry = await import('@napi-rs/canvas/geometry.js');
  const DOMMatrix = geometry.DOMMatrix ?? geometry.default?.DOMMatrix;
  if (typeof DOMMatrix !== 'function') {
    // Don't throw: a broken polyfill must not take down a server whose other routes
    // are fine. PDF uploads then fail on their own with extract.server.ts's named
    // error instead of a bare ReferenceError.
    console.error('[lexio/instrumentation] DOMMatrix polyfill unavailable — PDF parsing will fail');
    return;
  }
  globalThis.DOMMatrix = DOMMatrix;
}
