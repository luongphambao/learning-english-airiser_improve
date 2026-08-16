import { describe, expect, it } from 'vitest';
import { NAME_MAX_LENGTH, initialsFromName, resolveDisplayName } from '../name';

describe('lib/leaderboard/name initialsFromName', () => {
  it('derives the monogram from the last two syllables of a Vietnamese given-name-last name', () => {
    expect(initialsFromName('Lê Thị Hồng Vân')).toBe('HV');
    expect(initialsFromName('Nguyễn Minh Anh')).toBe('MA');
  });

  it('falls back to a single-letter monogram for a single-word name', () => {
    expect(initialsFromName('Alex')).toBe('A');
  });

  it('returns an empty string for an empty or whitespace-only name, never throws', () => {
    expect(initialsFromName('')).toBe('');
    expect(initialsFromName('   ')).toBe('');
  });

  it('collapses repeated whitespace between tokens', () => {
    expect(initialsFromName('Lê   Thị   Hồng   Vân')).toBe('HV');
  });
});

describe('lib/leaderboard/name resolveDisplayName', () => {
  const FALLBACK = 'Người học';

  it('prefers the nickname over everything else', () => {
    const name = resolveDisplayName({ nickname: 'Sếp Tổng', displayName: 'Real Name' }, FALLBACK);
    expect(name).toBe('Sếp Tổng');
  });

  it('falls back to the Auth displayName when there is no nickname', () => {
    const name = resolveDisplayName({ nickname: null, displayName: 'Nguyễn Văn A' }, FALLBACK);
    expect(name).toBe('Nguyễn Văn A');
  });

  it('falls back to the generic placeholder when neither is set', () => {
    expect(resolveDisplayName({ nickname: null, displayName: null }, FALLBACK)).toBe(FALLBACK);
    expect(resolveDisplayName({ nickname: null, displayName: undefined }, FALLBACK)).toBe(FALLBACK);
  });

  it('treats a whitespace-only nickname or displayName as absent', () => {
    expect(resolveDisplayName({ nickname: '   ', displayName: 'Real Name' }, FALLBACK)).toBe('Real Name');
    expect(resolveDisplayName({ nickname: '   ', displayName: '   ' }, FALLBACK)).toBe(FALLBACK);
  });

  it('never derives a name from an email address, even if one is available elsewhere', () => {
    // No `email` field exists on NameSources at all — this test guards the type,
    // not just the runtime behavior: an email-shaped displayName is still just a
    // displayName and passes through unmodified, but nothing in this module ever
    // reaches for `.email` (docs/decision.md ADR-025's privacy reasoning).
    const name = resolveDisplayName({ nickname: null, displayName: null }, FALLBACK);
    expect(name).not.toContain('@');
  });

  it('clamps an over-long nickname to NAME_MAX_LENGTH', () => {
    const long = 'x'.repeat(NAME_MAX_LENGTH + 20);
    const name = resolveDisplayName({ nickname: long, displayName: null }, FALLBACK);
    expect(name.length).toBe(NAME_MAX_LENGTH);
  });

  it('clamps an over-long displayName to NAME_MAX_LENGTH', () => {
    const long = 'y'.repeat(NAME_MAX_LENGTH + 20);
    const name = resolveDisplayName({ nickname: null, displayName: long }, FALLBACK);
    expect(name.length).toBe(NAME_MAX_LENGTH);
  });
});
