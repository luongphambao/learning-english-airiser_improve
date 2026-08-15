// Pure, clock-free, no I/O — text cleanup that both the PDF and DOCX paths in
// extract.server.ts share, kept here (unlike that file) so it can be unit tested
// without pulling in pdfjs-dist/mammoth (docs/decision.md ADR-021).

/**
 * pdfjs/mammoth both emit text as a flat stream of positioned fragments, not
 * paragraphs: a hyphenated word broken across a line becomes two fragments
 * ("lever-", "age"), and normal line breaks become a lone "\n" between words that
 * were one sentence. Both would otherwise leak into sentenceFromDoc verbatim.
 */
export function normalizeExtractedText(raw: string): string {
  return raw
    .replace(/-\n\s*/g, '') // "lever-\nage" -> "leverage"
    .replace(/\n+/g, ' ') // remaining line breaks are mid-sentence wraps, not paragraph breaks
    .replace(/[ \t]+/g, ' ')
    .trim();
}

const MIN_TEXT_CHARS = 200;

/** Below this, the "document" is almost certainly a scanned/image-only PDF with no
 * real text layer (pdfjs still returns a near-empty string rather than an error for
 * those) — the caller should surface a clear message instead of sending ~0 chars to
 * analyzeDocument. */
export function hasEnoughText(text: string): boolean {
  return text.replace(/\s/g, '').length >= MIN_TEXT_CHARS;
}

/**
 * Splits flat text with no natural page boundary (DOCX, pasted text) into
 * paragraph-sized units, so chunkUnits() can pack them the same way it packs real
 * PDF pages (docs/decision.md ADR-021). Splits on blank-line paragraph breaks;
 * a paragraph longer than targetChars is further split on sentence boundaries so
 * no single unit forces an oversized chunk. Falls back to the whole text as one
 * unit if it has neither paragraph nor sentence breaks.
 */
export function splitIntoUnits(text: string, targetChars = 1200): string[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const units: string[] = [];
  for (const para of paragraphs) {
    if (para.length <= targetChars) {
      units.push(para);
      continue;
    }
    const sentences = para.split(/(?<=[.!?])\s+/);
    let current = '';
    for (const sentence of sentences) {
      if (current && current.length + sentence.length + 1 > targetChars) {
        units.push(current);
        current = sentence;
      } else {
        current = current ? `${current} ${sentence}` : sentence;
      }
    }
    if (current) units.push(current);
  }

  if (units.length > 0) return units;
  const trimmed = text.trim();
  return trimmed ? [trimmed] : [];
}

export interface UnitChunk {
  text: string;
  fromUnit: number; // 1-based
  toUnit: number; // 1-based
}

export interface ChunkResult {
  chunks: UnitChunk[];
  /** Set to the unit number analysis stopped after, when units.length > maxUnits. */
  truncatedAtUnit: number | null;
}

/**
 * Greedily packs sequential units (PDF pages, or splitIntoUnits' paragraphs) into
 * AI-call-sized batches, never splitting a unit apart — a unit alone larger than
 * maxCharsPerChunk still becomes its own (oversized) chunk rather than being cut
 * mid-sentence. Caps total units considered at maxUnits so one huge document can't
 * fan out into an unbounded number of AI calls; the caller surfaces
 * truncatedAtUnit as a Vietnamese notice instead of silently dropping the rest.
 */
export function chunkUnits(units: string[], maxCharsPerChunk: number, maxUnits: number): ChunkResult {
  const truncatedAtUnit = units.length > maxUnits ? maxUnits : null;
  const limited = units.slice(0, maxUnits);

  const chunks: UnitChunk[] = [];
  let current = '';
  let fromUnit = 1;

  limited.forEach((unit, i) => {
    const unitNumber = i + 1;
    const wouldExceed = current.length > 0 && current.length + unit.length + 2 > maxCharsPerChunk;
    if (wouldExceed) {
      chunks.push({ text: current, fromUnit, toUnit: unitNumber - 1 });
      current = unit;
      fromUnit = unitNumber;
    } else {
      current = current ? `${current}\n\n${unit}` : unit;
    }
  });
  if (current) chunks.push({ text: current, fromUnit, toUnit: limited.length });

  return { chunks, truncatedAtUnit };
}
