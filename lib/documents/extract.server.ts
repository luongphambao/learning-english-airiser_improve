import 'server-only';
import type { ProblemCode } from '@/lib/api/problem';
import { hasEnoughText, normalizeExtractedText, splitIntoUnits } from './extract';

/** Mirrors AiError's shape (lib/ai/errors.ts) — a typed code the route maps
 * straight onto problemResponse, never a raw library error string reaching the
 * client (docs/api_document.md §0). */
export class DocumentParseError extends Error {
  readonly code: ProblemCode;

  constructor(code: ProblemCode, message?: string) {
    super(message ?? code);
    this.name = 'DocumentParseError';
    this.code = code;
  }
}

/** One string per real PDF page, in order — preserved (not joined) so a multi-page
 * upload can be analyzed in per-page batches with real "Trang N" progress instead
 * of one single AI call over the whole document (docs/decision.md ADR-021). */
async function extractPdfPages(buffer: ArrayBuffer): Promise<string[]> {
  // Dynamic import: keeps pdfjs-dist out of every request that isn't a PDF upload,
  // and — combined with next.config.ts's serverExternalPackages — out of webpack's
  // build-time parse entirely (docs/decision.md ADR-021, the OOM this avoids).
  const { getDocument, PasswordException, InvalidPDFException } = await import('pdfjs-dist/legacy/build/pdf.mjs');

  // No GlobalWorkerOptions.workerSrc needed: pdfjs falls back to running the
  // worker code in-process when `Worker` isn't a global (true in Node), which is
  // exactly the standalone server's runtime.
  const loadingTask = getDocument({ data: new Uint8Array(buffer) });
  let doc;
  try {
    doc = await loadingTask.promise;
  } catch (err) {
    if (err instanceof PasswordException) throw new DocumentParseError('document_encrypted');
    if (err instanceof InvalidPDFException) throw new DocumentParseError('bad_request', 'invalid_pdf');
    throw new DocumentParseError('unknown', err instanceof Error ? err.message : 'pdf_parse_failed');
  }

  try {
    const pages: string[] = [];
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();
      // Each item is a positioned text fragment, not a line — join with a space and
      // let normalizeExtractedText (extract.ts) collapse the resulting whitespace.
      const raw = content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
      pages.push(normalizeExtractedText(raw));
    }
    return pages;
  } finally {
    // PDFDocumentProxy has no destroy() in this version — the loading task owns
    // teardown of the underlying worker/transport.
    await loadingTask.destroy();
  }
}

/** DOCX has no fixed page concept (pagination is a Word rendering detail, not
 * stored in the document) — split the flat extracted text into paragraph-sized
 * units instead, via the same splitIntoUnits() a pasted-text upload uses. */
async function extractDocxUnits(buffer: ArrayBuffer): Promise<string[]> {
  const mammoth = await import('mammoth');
  let raw: string;
  try {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
    raw = result.value;
  } catch (err) {
    throw new DocumentParseError('unknown', err instanceof Error ? err.message : 'docx_parse_failed');
  }
  return splitIntoUnits(normalizeExtractedText(raw));
}

export type SupportedDocKind = 'pdf' | 'docx';

export function docKindForFileName(fileName: string): SupportedDocKind | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.docx')) return 'docx';
  return null;
}

export interface ExtractedDocument {
  units: string[];
  unitLabel: 'page' | 'part';
}

/** Extracts + normalizes text from an uploaded PDF/DOCX into ordered units (real
 * pages for PDF, paragraphs for DOCX) that the client chunks into AI-call-sized
 * batches (lib/documents/extract.ts chunkUnits) — throws
 * DocumentParseError('document_no_text') if the combined result is too thin to
 * analyze (the scanned/image-only PDF case). */
export async function extractDocumentText(kind: SupportedDocKind, buffer: ArrayBuffer): Promise<ExtractedDocument> {
  const units = kind === 'pdf' ? await extractPdfPages(buffer) : await extractDocxUnits(buffer);
  if (!hasEnoughText(units.join(' '))) throw new DocumentParseError('document_no_text');
  return { units, unitLabel: kind === 'pdf' ? 'page' : 'part' };
}
