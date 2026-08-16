import { describe, expect, it } from 'vitest';
import { translate, translateWith } from '../translate';

const FIXTURE = {
  vi: { greeting: { morning: 'Chào buổi sáng', onlyInVi: 'Chỉ có ở đây' } },
  en: { greeting: { morning: 'Good morning' } },
};

describe('lib/i18n/translate', () => {
  it('looks up a nested dot-path key in the requested locale', () => {
    expect(translate('en', 'common.settings')).toBe('Settings');
    expect(translate('vi', 'common.settings')).toBe('Cài đặt');
  });

  it('interpolates {{var}} placeholders from the vars object', () => {
    expect(translate('en', 'appHeader.streakDays', { count: 7 })).toBe('7 days');
    expect(translate('vi', 'appHeader.streakDays', { count: 7 })).toBe('7 ngày');
  });

  it('leaves an unmatched placeholder untouched instead of throwing', () => {
    expect(translate('en', 'appHeader.streakDays', {})).toBe('{{count}} days');
  });

  it('falls back to the raw key when it exists in neither dictionary', () => {
    expect(translate('en', 'nope.notReal')).toBe('nope.notReal');
  });

  it('falls back to Vietnamese when a key is missing from the English dictionary', () => {
    // Simulates an in-progress translation: every VN key must resolve even if EN
    // hasn't been filled in yet, so partial i18n coverage never blanks the UI.
    expect(translateWith(FIXTURE, 'en', 'greeting.onlyInVi')).toBe('Chỉ có ở đây');
  });

  it('never mutates the dictionaries it is given', () => {
    const before = JSON.stringify(FIXTURE);
    translateWith(FIXTURE, 'en', 'greeting.morning', { x: 1 });
    expect(JSON.stringify(FIXTURE)).toBe(before);
  });
});
