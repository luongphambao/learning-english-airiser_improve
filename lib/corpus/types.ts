import { z } from 'zod';
import { CefrSchema, type Cefr } from '@/lib/domain';

// Mirrors the tuple-array shape scripts/build-corpus.ts emits into
// public/corpus/v1/*.json — tuples instead of objects keep the shipped file ~3x
// smaller (docs/decision.md ADR-015).
export const CorpusPosSchema = z.enum(['n', 'v', 'adj', 'adv', 'phr']);
export type CorpusPos = z.infer<typeof CorpusPosSchema>;

export const CorpusRowSchema = z.tuple([
  z.string().min(1), // word
  CorpusPosSchema,
  z.number().int().positive(), // rank, 1-indexed within the band
  z.string().min(1), // Vietnamese gloss
]);

export const CorpusBandFileSchema = z.object({
  band: CefrSchema,
  count: z.number().int().nonnegative(),
  source: z.enum(['authored', 'ngsl', 'nawl', 'bsl', 'generated']),
  cols: z.tuple([z.literal('w'), z.literal('pos'), z.literal('rank'), z.literal('vi')]),
  rows: z.array(CorpusRowSchema),
});
export type CorpusBandFile = z.infer<typeof CorpusBandFileSchema>;

export const CorpusManifestSchema = z.object({
  version: z.string(),
  bands: z.record(z.string(), z.object({ count: z.number().int(), source: z.string() })),
});
export type CorpusManifest = z.infer<typeof CorpusManifestSchema>;

// The normalized, in-memory shape every lib/corpus/** consumer works with — the
// tuple row plus the band it came from, so a merged list (e.g. level + level+1)
// doesn't lose which band each entry belongs to.
export interface CorpusEntry {
  word: string;
  pos: CorpusPos;
  rank: number;
  vi: string;
  band: Cefr;
}
