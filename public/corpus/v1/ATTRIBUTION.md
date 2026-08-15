# Corpus provenance (v1)

**What this is.** `A2.json` … `C2.json` are an originally-compiled starter
vocabulary list for Vietnamese professionals learning workplace English:
real English words, hand-picked and hand-banded by difficulty, with
original Vietnamese glosses. The list, the band assignment, and the
translations were authored directly for this repository
(`scripts/corpus-source-data.ts`) and built into these JSON files by
`scripts/build-corpus.ts`.

**What this is *not*.** An earlier design draft for this corpus planned to
derive CEFR bands from three openly-licensed frequency lists — the New
General Service List (NGSL), New Academic Word List (NAWL), and Business
Service List (BSL), all by Charles Browne, Brent Culligan & Joseph
Phillips, CC BY-SA 4.0, newgeneralservicelist.com — plus a Gemini-
generated C2 top-up (NGSL tops out around C1). That data was **not**
actually fetched, parsed, or verified in the session that produced this
file, so this corpus does **not** carry an NGSL/NAWL/BSL CC BY-SA
attribution. Claiming that license for content that wasn't actually
derived from those lists would misstate its provenance.

**Why band accuracy is approximate.** Without real corpus-frequency data,
`rank` inside each band file is simply the word's position in the
hand-authored list (1-indexed), not a measured frequency rank. It is
still useful for `lib/corpus/pick.ts` (which only needs a stable,
deterministic ordering within a band), but it is not a claim of
linguistic frequency.

**The intended real data source, for whoever does this next.** Point
`scripts/build-corpus.ts` at `corpus-src/{ngsl,nawl,bsl}.csv` (word, rank
columns; the directory is gitignored — never commit the raw third-party
files), run each row through a `cefrFromRank(rank, list)` heuristic
(`lib/level/cefr.ts`), and keep this file's `cols`/`rows` shape and
`lib/corpus/**`/`lib/level/**` unchanged. When that swap happens, this
file must be rewritten with the real CC BY-SA 4.0 attribution text,
the exact source URLs, a SHA-256 of the downloaded files, and the
download date (docs/decision.md ADR-015).
