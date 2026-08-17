import { describe, it, expect } from 'vitest';
import { escapeHtml } from '../html-escape';

describe('escapeHtml', () => {
  it('escapes every character that can break out of HTML text or an attribute', () => {
    expect(escapeHtml(`& < > " '`)).toBe('&amp; &lt; &gt; &quot; &#39;');
  });

  it('neutralises an injected script tag', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    );
  });

  it('escapes the ampersand once, not twice', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('leaves ordinary text, including Vietnamese diacritics, untouched', () => {
    expect(escapeHtml('tận dụng để tạo lợi thế')).toBe('tận dụng để tạo lợi thế');
  });
});
