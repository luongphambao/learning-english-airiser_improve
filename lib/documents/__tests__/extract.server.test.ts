import { describe, expect, it } from 'vitest';
import { docKindForFileName, extractDocumentText } from '../extract.server';

// A real single-page PDF (valid xref, Helvetica, five Tj lines). Its text clears
// MIN_TEXT_CHARS in extract.ts so extraction reaches a successful return instead of
// tripping the document_no_text guard. Inline base64 rather than a fixture file so
// the test can't be silently defeated by a missing or renamed asset.
const SAMPLE_PDF_BASE64 =
  'JVBERi0xLjQKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PgplbmRvYmoKMyAwIG9iago8PC9UeXBlL1BhZ2UvUGFyZW50IDIgMCBSL01lZGlhQm94WzAgMCA0MDAgMjAwXS9SZXNvdXJjZXM8PC9Gb250PDwvRjEgNCAwIFI+Pj4+L0NvbnRlbnRzIDUgMCBSPj4KZW5kb2JqCjQgMCBvYmoKPDwvVHlwZS9Gb250L1N1YnR5cGUvVHlwZTEvQmFzZUZvbnQvSGVsdmV0aWNhPj4KZW5kb2JqCjUgMCBvYmoKPDwvTGVuZ3RoIDM3ND4+CnN0cmVhbQpCVAovRjEgMTIgVGYKMjAgMTcwIFRkCihRdWFydGVybHkgcmVwb3J0IG9uIHRoZSBsb2NhbGl6YXRpb24gcm9sbG91dC4pIFRqCjAgLTIwIFRkCihUaGUgbWlncmF0aW9uIHJlZHVjZWQgYXZlcmFnZSBsYXRlbmN5IGFjcm9zcyB0aGUgcGlwZWxpbmUuKSBUagowIC0yMCBUZAooU3Rha2Vob2xkZXJzIGFwcHJvdmVkIHRoZSByZXZpc2VkIGRlcGxveW1lbnQgc2NoZWR1bGUuKSBUagowIC0yMCBUZAooUmVtYWluaW5nIHdvcmsgY292ZXJzIGFjY2Vzc2liaWxpdHkgYW5kIGRvY3VtZW50YXRpb24uKSBUagowIC0yMCBUZAooVGhlIHRlYW0gd2lsbCBwdWJsaXNoIHVwZGF0ZWQgb25ib2FyZGluZyBtYXRlcmlhbCBuZXh0IHNwcmludC4pIFRqCjAgLTIwIFRkCkVUCmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTQgMDAwMDAgbiAKMDAwMDAwMDEwNSAwMDAwMCBuIAowMDAwMDAwMjE3IDAwMDAwIG4gCjAwMDAwMDAyODAgMDAwMDAgbiAKdHJhaWxlcgo8PC9TaXplIDYvUm9vdCAxIDAgUj4+CnN0YXJ0eHJlZgo3MDIKJSVFT0Y=';

function samplePdf(): ArrayBuffer {
  const bytes = Buffer.from(SAMPLE_PDF_BASE64, 'base64');
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe('docKindForFileName', () => {
  it('recognizes pdf and docx regardless of case', () => {
    expect(docKindForFileName('report.PDF')).toBe('pdf');
    expect(docKindForFileName('notes.docx')).toBe('docx');
  });

  it('returns null for anything the server does not parse', () => {
    expect(docKindForFileName('notes.txt')).toBeNull();
    expect(docKindForFileName('pdf')).toBeNull();
  });
});

// Regression guard for the Cloud Run failure "[lexio/parse-doc] failed: DOMMatrix is
// not defined" — pdfjs 6.x builds a DOMMatrix while its module is still evaluating, so
// importing it at all blows up on a runtime without that global. extract.server.ts
// polyfills from @napi-rs/canvas/geometry.js first.
//
// Scope, honestly: the first test is the one that guards the fix's weak point — the
// undocumented submodule path it reaches into, which a @napi-rs/canvas upgrade could
// move or hide behind an `exports` map. Neither test reproduces the container itself:
// a dev machine has the full node_modules tree, so pdfjs's own native fallback would
// paper over a deleted polyfill here while still failing in .next/standalone. Verify
// that end by hiding node_modules/@napi-rs/canvas-<platform> and importing pdfjs.
describe('pdf extraction DOMMatrix polyfill', () => {
  it('exposes a spec-shaped DOMMatrix at the path extract.server.ts polyfills from', async () => {
    const { DOMMatrix } = await import('@napi-rs/canvas/geometry.js');
    const identity = new DOMMatrix();
    expect([identity.a, identity.b, identity.c, identity.d, identity.e, identity.f]).toEqual([1, 0, 0, 1, 0, 0]);
    // The methods pdfjs actually calls on it — a stub missing these would satisfy the
    // import but break at the first real transform.
    expect(typeof identity.multiplySelf).toBe('function');
    expect(typeof identity.invertSelf).toBe('function');
    expect(typeof identity.translate).toBe('function');
  });

  it('extracts every line of a real pdf without a DOM present', async () => {
    // `environment: 'node'` (vitest.config.ts) means no DOM globals here, the same
    // condition the standalone server runs under.
    const result = await extractDocumentText('pdf', samplePdf());
    expect(result.unitLabel).toBe('page');
    expect(result.units).toHaveLength(1);
    expect(result.units[0]).toContain('Quarterly report on the localization rollout.');
    expect(result.units[0]).toContain('updated onboarding material next sprint.');
  });
});
