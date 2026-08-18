import { markKey, resolveMarked } from './marked-key';

/**
 * A failed AI call used to reach the UI as a Vietnamese sentence — either
 * `ApiError.messageVi` (which the server picks from its own static Vietnamese table,
 * lib/api/problem.ts) or a hardcoded fallback in the store. Both froze the message
 * in Vietnamese regardless of the interface language, and doc-store/work-store also
 * persist theirs onto the `imports` row, so a failed import stayed Vietnamese
 * forever.
 *
 * `ApiError.code` is the stable, machine-readable half of that response and is what
 * the store keeps instead. It becomes a marked i18n key (lib/i18n/marked-key.ts) so
 * the same field can still carry a legacy Vietnamese string from an `imports` row
 * written before this change — those have no marker and render verbatim, so there is
 * nothing to backfill.
 *
 * The dictionary block `apiError.*` mirrors `MESSAGE_VI` in lib/api/problem.ts. It
 * is NOT generated from `ProblemCode`: that module is `server-only`, and importing
 * it here would drag server code into the browser bundle. A code with no dictionary
 * entry — a new server code against an older client — degrades to the generic
 * message rather than printing "apiError.whatever" (see resolveMarked).
 */
export function apiErrorKey(code: string): string {
  return markKey(`apiError.${code}`);
}

/** Every non-API failure a store can report also travels as a marked key, so the
 * component has exactly one thing to resolve. */
export const ERROR_KEY = {
  /** The call succeeded and returned nothing — a different thing from it failing,
   * and the only one of these the learner can act on (describe the topic better). */
  topicEmpty: markKey('learnTopic.error.empty'),
  topicFailed: markKey('learnTopic.error.fallback'),
  docFailed: markKey('learnDoc.error.fallback'),
  workFailed: markKey('learn.genericError'),
} as const;

/**
 * `errorKey` -> display text, with `apiError.unknown` as the last resort for an
 * unrecognised key. Callers pass their own screen-specific `fallback` only when
 * they have something better to say than the generic phrase.
 */
export function resolveErrorMessage(
  errorKey: string | null | undefined,
  t: (key: string, vars?: Record<string, string | number>) => string,
  fallback: string = t('apiError.unknown'),
): string {
  return resolveMarked(errorKey, t, fallback);
}
