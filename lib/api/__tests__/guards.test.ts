import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { isAllowedOrigin, contentLengthExceeds } from '../guards';

function request(headers: Record<string, string>): NextRequest {
  return new NextRequest('http://localhost:3000/api/ai/extract', { method: 'POST', headers });
}

describe('isAllowedOrigin', () => {
  it('accepts a same-origin browser fetch', () => {
    expect(isAllowedOrigin(request({ 'sec-fetch-site': 'same-origin' }))).toBe(true);
    expect(isAllowedOrigin(request({ 'sec-fetch-site': 'same-site' }))).toBe(true);
  });

  it('rejects a request carrying neither Origin nor Sec-Fetch-Site', () => {
    // curl and every other scripted client land here. This used to be allowed,
    // which made the guard a no-op for anything that was not a browser.
    expect(isAllowedOrigin(request({}))).toBe(false);
  });

  it('rejects a cross-site browser request', () => {
    expect(
      isAllowedOrigin(request({ 'sec-fetch-site': 'cross-site', origin: 'https://evil.example' })),
    ).toBe(false);
  });

  it('accepts an allow-listed Origin when Sec-Fetch-Site is absent', () => {
    expect(isAllowedOrigin(request({ origin: 'http://localhost:3000' }))).toBe(true);
  });

  it('rejects an unknown Origin', () => {
    expect(isAllowedOrigin(request({ origin: 'https://evil.example' }))).toBe(false);
  });
});

describe('contentLengthExceeds', () => {
  it('rejects a declared body over the cap', () => {
    expect(contentLengthExceeds(request({ 'content-length': '2048' }), 1024)).toBe(true);
  });

  it('allows a declared body under the cap', () => {
    expect(contentLengthExceeds(request({ 'content-length': '512' }), 1024)).toBe(false);
  });

  it('defers to the streaming read when the header is absent', () => {
    expect(contentLengthExceeds(request({}), 1024)).toBe(false);
  });
});
