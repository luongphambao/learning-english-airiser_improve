/**
 * `Word.source.label` is a mixed field. Some values are user data that must NEVER
 * be translated — an uploaded document's name reaches it as e.g.
 * "Công việc: report.pdf". Others are fixed system labels ("Tự thêm", "Đoạn văn đã
 * dán", "Bài kiểm tra trình độ") that should follow the interface language.
 *
 * Storing already-translated text for the second kind froze it in whichever
 * language was active when the row was written: a notebook built in Vietnamese
 * still showed "Tự thêm" after switching to English, forever, because the phrase
 * was persisted to Dexie (and synced to Firestore) rather than resolved at render.
 *
 * The fix keeps one field and needs no migration: system writers store a marked
 * i18n KEY instead of a phrase, and `resolveSourceLabel()` translates anything
 * carrying the marker while passing every other value through untouched. Rows
 * written before this change hold plain Vietnamese text, which has no marker, so
 * they keep rendering exactly as they always did — nothing to backfill, and a
 * user's own filenames can never be mistaken for a key.
 *
 * The marker is `@`, which cannot begin a document name produced by
 * lib/documents/** and is not used by any other label writer.
 */
const MARKER = '@';

/** The only labels a system writer may store. Anything else in `source.label` is
 * user data and is rendered verbatim. */
export const SOURCE_KEY = {
  manual: `${MARKER}vocabulary.sourceKind.manual`,
  paste: `${MARKER}vocabulary.sourceKind.paste`,
  placement: `${MARKER}vocabulary.sourceKind.placement`,
} as const;

/**
 * `label` -> display text. `t` is the caller's bound translator (hooks/use-i18n),
 * `fallback` covers rows whose label is empty or missing — several older writers
 * and every test fixture store `label: ''`.
 */
export function resolveSourceLabel(
  label: string | null | undefined,
  t: (key: string) => string,
  fallback: string,
): string {
  if (!label) return fallback;
  return label.startsWith(MARKER) ? t(label.slice(MARKER.length)) : label;
}
