import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CEFR_ORDER } from '@/lib/domain';
import { CorpusBandFileSchema, CorpusManifestSchema } from '../types';

// Validates the ACTUALLY SHIPPED public/corpus/v1/*.json — not the source data it
// was built from. This is what catches a bad `npm run corpus:build` regeneration
// before it ships (docs/decision.md ADR-015): a corrupted band file, a duplicate
// headword across bands, or a manifest that drifted from the files it describes.
const CORPUS_DIR = join(__dirname, '..', '..', '..', 'public', 'corpus', 'v1');
const BANDS = ['A2', 'B1', 'B2', 'C1', 'C2'] as const;

function readJson(name: string): unknown {
  return JSON.parse(readFileSync(join(CORPUS_DIR, name), 'utf-8'));
}

describe('shipped corpus files (public/corpus/v1)', () => {
  it('every band file validates against CorpusBandFileSchema', () => {
    for (const band of BANDS) {
      const parsed = CorpusBandFileSchema.safeParse(readJson(`${band}.json`));
      expect(parsed.success, `${band}.json: ${parsed.success ? '' : JSON.stringify(parsed.error.issues)}`).toBe(true);
    }
  });

  it('every band file is internally banded correctly (band field matches filename)', () => {
    for (const band of BANDS) {
      const file = CorpusBandFileSchema.parse(readJson(`${band}.json`));
      expect(file.band).toBe(band);
      expect(CEFR_ORDER).toContain(file.band);
    }
  });

  it('ranks are 1-indexed and strictly ascending within each band', () => {
    for (const band of BANDS) {
      const file = CorpusBandFileSchema.parse(readJson(`${band}.json`));
      const ranks = file.rows.map((r) => r[2]);
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
      expect(ranks[0]).toBe(1);
      expect(new Set(ranks).size).toBe(ranks.length); // no duplicate ranks
    }
  });

  it('no headword is duplicated within or across bands (case-insensitive)', () => {
    const seen = new Map<string, string>(); // wordLower -> band
    for (const band of BANDS) {
      const file = CorpusBandFileSchema.parse(readJson(`${band}.json`));
      for (const [word] of file.rows) {
        const key = word.toLowerCase();
        const existingBand = seen.get(key);
        expect(existingBand, `"${word}" appears in both ${existingBand} and ${band}`).toBeUndefined();
        seen.set(key, band);
      }
    }
  });

  it('manifest.json counts and bands match the actual band files', () => {
    const manifest = CorpusManifestSchema.parse(readJson('manifest.json'));
    expect(manifest.version).toBe('v1');
    for (const band of BANDS) {
      const file = CorpusBandFileSchema.parse(readJson(`${band}.json`));
      expect(manifest.bands[band]?.count).toBe(file.count);
      expect(manifest.bands[band]?.count).toBe(file.rows.length);
    }
  });
});
