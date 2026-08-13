// Single source of truth for every shared domain type — see docs/data-model.md.
// types.ts at the repo root re-exports this barrel unchanged so existing imports
// (`from '@/types'`) keep working.
export * from './word';
export * from './review';
export * from './user';
export * from './tutor-session'; // Session only — see that file's header comment.
export * from './work';
export * from './import';
export * from './grammar';
