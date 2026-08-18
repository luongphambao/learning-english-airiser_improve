import { describe, expect, it } from 'vitest';
import { resolveSourceLabel, topicSourceLabel, SOURCE_KEY } from '../source-label';

const t = (key: string, vars?: Record<string, string | number>) =>
  vars ? `${key}(${JSON.stringify(vars)})` : key;

describe('resolveSourceLabel', () => {
  it('translates a marked key with no argument', () => {
    expect(resolveSourceLabel(SOURCE_KEY.manual, t, 'fallback')).toBe('vocabulary.sourceKind.manual');
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
    expect(resolveSourceLabel(topicSourceLabel('môi trường'), t, 'fallback')).toBe(
      'vocabulary.sourceKind.topic({"value":"môi trường"})',
    );
  });

  it('splits on the first separator only, so a stray one cannot change the key', () => {
    expect(resolveSourceLabel('@vocabulary.sourceKind.topic|a|b', t, 'fallback')).toBe(
      'vocabulary.sourceKind.topic({"value":"a|b"})',
    );
  });
});

describe('topicSourceLabel', () => {
  it('strips separators out of the topic so the stored label stays one key plus one value', () => {
    expect(topicSourceLabel('môi | trường')).toBe('@vocabulary.sourceKind.topic|môi   trường');
  });
});
