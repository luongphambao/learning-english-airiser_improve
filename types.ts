// Kept at the repo root because every existing import uses `from '@/types'`
// (`@/*` -> `./*`). The actual schemas live in lib/domain/** — see docs/data-model.md
// and docs/decision.md ADR (single source of truth: zod schema -> TS type).
export * from '@/lib/domain';
