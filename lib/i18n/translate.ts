import type { Locale } from '@/lib/domain';
import vi from './dictionaries/vi.json';
import en from './dictionaries/en.json';

type Dictionary = Record<string, unknown>;

export const DICTIONARIES: Record<Locale, Dictionary> = { vi, en };

function lookup(dict: Dictionary, key: string): string | undefined {
  const value: unknown = key.split('.').reduce<unknown>((node, part) => {
    if (node && typeof node === 'object' && part in (node as Dictionary)) {
      return (node as Dictionary)[part];
    }
    return undefined;
  }, dict);
  return typeof value === 'string' ? value : undefined;
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

/** Pure — looks up `key` (dot path, e.g. "today.greetingMorning") in `locale`'s
 * dictionary. Falls back to Vietnamese (the app's original, always-complete
 * dictionary) if a key is missing from `en`, and finally to the raw key itself if
 * missing from both — a translation gap should never crash or blank out the UI.
 * Takes `dictionaries` as a parameter (rather than reading the module-level
 * DICTIONARIES singleton directly) so tests can exercise the fallback logic
 * against fixture dictionaries instead of coupling to real app copy. */
export function translateWith(
  dictionaries: Record<Locale, Dictionary>,
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const template = lookup(dictionaries[locale], key) ?? lookup(dictionaries.vi, key) ?? key;
  return interpolate(template, vars);
}

export function translate(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  return translateWith(DICTIONARIES, locale, key, vars);
}
