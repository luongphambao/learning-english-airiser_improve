// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { enterGuestMode, exitGuestMode, isGuestMode } from '../guest';

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('guest mode', () => {
  it('is off until explicitly entered', () => {
    expect(isGuestMode()).toBe(false);
  });

  it('round-trips through enter and exit', () => {
    enterGuestMode();
    expect(isGuestMode()).toBe(true);
    exitGuestMode();
    expect(isGuestMode()).toBe(false);
  });

  it('ignores any value other than the exact flag', () => {
    window.localStorage.setItem('lexio:guest', 'true');
    expect(isGuestMode()).toBe(false);
  });

  it('reports "not a guest" rather than throwing when storage is blocked', () => {
    // Safari private mode throws on access rather than returning null. A guest
    // flag that cannot be read must fall back to asking for a login, not crash
    // the gate in app/providers.tsx.
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(isGuestMode()).toBe(false);
  });

  it('does not throw when storage refuses a write', () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => enterGuestMode()).not.toThrow();
  });
});
