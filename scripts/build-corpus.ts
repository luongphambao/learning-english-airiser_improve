// Regenerates public/corpus/v1/** from scripts/corpus-source-data.ts.
//
// Run with `npm run corpus:build`. Deliberately NOT part of `next build` — this is a
// content-authoring step, not a compile step (docs/decision.md ADR-015), same as
// how the app's own AI prompts aren't regenerated on every build.
//
// FUTURE PATH TO A REAL NGSL/NAWL/BSL-DERIVED CORPUS: replace the imports below with
// a CSV reader over corpus-src/{ngsl,nawl,bsl}.csv (word,rank columns, gitignored —
// never commit third-party source files), run each row through a cefrFromRank(rank,
// list) heuristic (lib/level/cefr.ts once that lands), and keep everything below
// this line — validation, manifest, per-band emission — unchanged. See
// scripts/corpus-source-data.ts's header comment for why this session ships an
// originally-authored list instead.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { A2, B1, B2, C1, C2, type SourceEntry } from './corpus-source-data';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'corpus', 'v1');
const COLS = ['w', 'pos', 'rank', 'vi'] as const;

const BANDS: Record<string, SourceEntry[]> = { A2, B1, B2, C1, C2 };

function assertNoCrossBandDuplicates() {
  const seen = new Map<string, string>(); // wordLower -> band
  for (const [band, entries] of Object.entries(BANDS)) {
    for (const { w } of entries) {
      const key = w.toLowerCase();
      const existingBand = seen.get(key);
      if (existingBand) {
        throw new Error(`corpus:build — "${w}" appears in both ${existingBand} and ${band}`);
      }
      seen.set(key, band);
    }
  }
}

function buildBandFile(band: string, entries: SourceEntry[]) {
  const rows = entries.map((e, i) => [e.w, e.pos, i + 1, e.vi]);
  return { band, count: rows.length, source: 'authored' as const, cols: COLS, rows };
}

function main() {
  assertNoCrossBandDuplicates();
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  const manifest: {
    version: string;
    bands: Record<string, { count: number; source: string }>;
  } = { version: 'v1', bands: {} };

  for (const [band, entries] of Object.entries(BANDS)) {
    const file = buildBandFile(band, entries);
    writeFileSync(join(OUT_DIR, `${band}.json`), JSON.stringify(file, null, 2) + '\n');
    manifest.bands[band] = { count: file.count, source: file.source };
    console.log(`corpus:build — wrote ${band}.json (${file.count} words)`);
  }

  writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log('corpus:build — wrote manifest.json');
}

main();
