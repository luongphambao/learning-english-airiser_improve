/**
 * A string field that must hold BOTH user data (never translated) and system text
 * (must follow the interface language) needs a way to tell the two apart at render
 * time. Storing already-translated text for the system case freezes it in whichever
 * language was active when it was written — see lib/i18n/source-label.ts for the
 * original instance of that bug.
 *
 * The convention: a system writer stores a marked i18n KEY, everything else is
 * passed through verbatim. Two shapes:
 *
 *   `@some.key`            -> t('some.key')
 *   `@some.key|<text>`     -> t('some.key', { value: '<text>' })
 *
 * The second form is what lets a system phrase wrap a piece of user data ("Chủ đề:
 * {{value}}") without freezing the phrase or translating the data.
 *
 * The marker is `@`, which cannot begin a document name produced by
 * lib/documents/** and is not used by any label writer.
 *
 * Two consumers, deliberately kept as separate named wrappers over this one
 * mechanism rather than one grab-bag helper: lib/i18n/source-label.ts
 * (`Word.source.label`) and lib/i18n/api-error.ts (a failed AI call's message,
 * which stores/*-store.ts hold in state and doc/work-store also persist on the
 * `imports` row).
 */
const MARKER = '@';

/** Separates the key from its one interpolated argument in the `@key|value` form. */
const ARG_SEPARATOR = '|';

/**
 * Builds a marked key. `arg` (when given) is stripped of separators rather than
 * escaped — a `|` inside it carries no meaning worth preserving, and resolveMarked()
 * splitting on the FIRST separator means a stray one could only ever truncate the
 * display, never change which key is looked up.
 */
export function markKey(key: string, arg?: string): string {
  if (arg === undefined) return `${MARKER}${key}`;
  return `${MARKER}${key}${ARG_SEPARATOR}${arg.split(ARG_SEPARATOR).join(' ').trim()}`;
}

/**
 * `value` -> display text.
 *
 * - empty/absent            -> `fallback`
 * - no marker               -> returned verbatim (user data, and every row written
 *                              before the field became a key — nothing to backfill)
 * - marked, key resolves    -> the translation
 * - marked, key missing     -> `fallback`, because translate() returns the raw key
 *                              on a miss and "vocabulary.sourceKind.typo" on screen
 *                              is worse than a generic phrase
 *
 * `t` is the caller's bound translator (hooks/use-i18n).
 */
export function resolveMarked(
  value: string | null | undefined,
  t: (key: string, vars?: Record<string, string | number>) => string,
  fallback: string,
): string {
  if (!value) return fallback;
  if (!value.startsWith(MARKER)) return value;

  const body = value.slice(MARKER.length);
  const separatorAt = body.indexOf(ARG_SEPARATOR);
  const key = separatorAt === -1 ? body : body.slice(0, separatorAt);
  const vars = separatorAt === -1 ? undefined : { value: body.slice(separatorAt + 1) };

  const text = t(key, vars);
  return text === key ? fallback : text;
}
