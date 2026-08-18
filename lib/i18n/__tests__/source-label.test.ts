import { describe, expect, it } from 'vitest';
import { resolveSourceLabel, topicSourceLabel, SOURCE_KEY } from '../source-label';

// A stub translator that does NOT echo the key back, because echoing is exactly how
// resolveMarked() detects a key missing from every dictionary — an echoing stub
// would make every lookup here look like a miss.
const DICT: Record<string, string> = {
  'vocabulary.sourceKind.manual': 'Tự thêm',
  'vocabulary.sourceKind.topic': 'Chủ đề: {{value}}',
};
const t = (key: string, vars?: Record<string, string | number>) => {
  const template = DICT[key];
  if (template === undefined) return key; // same miss behaviour as lib/i18n/translate.ts
  return template.replace(/\{\{(\w+)\}\}/g, (m, name: string) => (vars && name in vars ? String(vars[name]) : m));
};

describe('resolveSourceLabel', () => {
  it('translates a marked key with no argument', () => {
    expect(resolveSourceLabel(SOURCE_KEY.manual, t, 'fallback')).toBe('Tự thêm');
  });

  it('passes user data through untouched', () => {
    expect(resolveSourceLabel('Tài liệu: report.pdf', t, 'fallback')).toBe('Tài liệu: report.pdf');
  });

  it('falls back when the label is empty or missing', () => {
    expect(resolveSourceLabel('', t, 'fallback')).toBe('fallback');
    expect(resolveSourceLabel(null, t, 'fallback')).toBe('fallback');
    expect(resolveSourceLabel(undefined, t, 'fallback')).toBe('fallback');
  });

  it('interpolates the argument of a marked key that carries one', () => {
    expect(resolveSourceLabel(topicSourceLabel('môi trường'), t, 'fallback')).toBe('Chủ đề: môi trường');
  });

  it('splits on the first separator only, so a stray one cannot change the key', () => {
    expect(resolveSourceLabel('@vocabulary.sourceKind.topic|a|b', t, 'fallback')).toBe('Chủ đề: a|b');
  });

  it('falls back rather than printing a raw dot-path when the key is unknown', () => {
    expect(resolveSourceLabel('@vocabulary.sourceKind.typo', t, 'fallback')).toBe('fallback');
  });
});

describe('topicSourceLabel', () => {
  it('strips separators out of the topic so the stored label stays one key plus one value', () => {
    expect(topicSourceLabel('môi | trường')).toBe('@vocabulary.sourceKind.topic|môi   trường');
  });
});
