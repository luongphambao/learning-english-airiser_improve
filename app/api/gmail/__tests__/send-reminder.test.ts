import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { MemoryRateLimiter } from '@/lib/api/rate-limit';

const sendMock = vi.fn();
const getStoredTokensMock = vi.fn();

vi.mock('googleapis', () => ({
  google: {
    gmail: () => ({ users: { messages: { send: sendMock } } }),
  },
}));

vi.mock('@/lib/auth/google', () => ({
  getStoredTokens: () => getStoredTokensMock(),
  setStoredTokens: vi.fn(),
  getOAuth2Client: () => ({ setCredentials: vi.fn(), on: vi.fn() }),
}));

const { POST } = await import('../send-reminder/route');

/** Decodes the base64url RFC 2822 message the route handed to the Gmail API. */
function sentMessage(): string {
  const raw = sendMock.mock.calls.at(-1)![0].requestBody.raw as string;
  return Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

function post(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost:3000/api/gmail/send-reminder', {
    method: 'POST',
    headers: { 'sec-fetch-site': 'same-origin', 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

const WORD = { word: 'throughput', meaningVi: 'thông lượng' };

// getRateLimiter() memoizes one limiter on globalThis so dev HMR doesn't reset
// counters; without this every test after the third would 429 on the shared bucket.
const LIMITER_KEY = Symbol.for('lexio.api.rateLimiter');

beforeEach(() => {
  (globalThis as unknown as Record<symbol, unknown>)[LIMITER_KEY] = new MemoryRateLimiter();
  sendMock.mockReset();
  sendMock.mockResolvedValue({ data: { id: 'msg_1' } });
  getStoredTokensMock.mockReset();
  getStoredTokensMock.mockResolvedValue({ access_token: 'tok', email: 'user@example.com' });
});

describe('POST /api/gmail/send-reminder', () => {
  it('rejects a request that carries neither Origin nor Sec-Fetch-Site', async () => {
    const res = await POST(
      new NextRequest('http://localhost:3000/api/gmail/send-reminder', {
        method: 'POST',
        body: JSON.stringify({ words: [WORD] }),
      }),
    );
    expect(res.status).toBe(403);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('rejects an empty body instead of sending the old hard-coded demo words', async () => {
    const res = await POST(post({}));
    expect(res.status).toBe(422);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('rejects a recipient containing a line break (header injection)', async () => {
    const res = await POST(
      post({ words: [WORD], recipient: 'ok@example.com\r\nBcc: attacker@evil.example' }),
    );
    expect(res.status).toBe(422);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('rejects a recipient that is not an email address', async () => {
    expect((await POST(post({ words: [WORD], recipient: 'not-an-email' }))).status).toBe(422);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('escapes HTML in every interpolated word field', async () => {
    const res = await POST(
      post({
        words: [
          {
            word: '<img src=x onerror=alert(1)>',
            meaningVi: '<b>đậm</b>',
            exampleSentence: '<script>steal()</script>',
            ipa: '"><a href=evil>',
          },
        ],
      }),
    );

    expect(res.status).toBe(200);
    const message = sentMessage();
    expect(message).not.toContain('<img src=x');
    expect(message).not.toContain('<script>steal()');
    expect(message).not.toContain('<b>đậm</b>');
    expect(message).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(message).toContain('&lt;script&gt;steal()&lt;/script&gt;');
  });

  it('sends to a valid custom recipient on a single To header', async () => {
    const res = await POST(post({ words: [WORD], recipient: 'boss@example.com' }));
    expect(res.status).toBe(200);

    const headerBlock = sentMessage().split('\r\n\r\n')[0]!;
    expect(headerBlock).toContain('To: boss@example.com');
    expect(headerBlock.match(/^To:/gm)).toHaveLength(1);
    expect(headerBlock).not.toMatch(/^Bcc:/m);
  });

  it('rate limits repeated sends so the account cannot burn its Gmail quota', async () => {
    for (let i = 0; i < 3; i++) {
      expect((await POST(post({ words: [WORD] }))).status).toBe(200);
    }
    const blocked = await POST(post({ words: [WORD] }));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toBeTruthy();
    expect(sendMock).toHaveBeenCalledTimes(3);
  });

  it('returns a 401 problem when Gmail is not connected', async () => {
    getStoredTokensMock.mockResolvedValue(null);
    const res = await POST(post({ words: [WORD] }));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('gmail_not_connected');
  });

  it('never echoes an upstream googleapis error back to the client', async () => {
    sendMock.mockRejectedValue(new Error('Quota exceeded for project lexio-prod-482910'));
    const res = await POST(post({ words: [WORD] }));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain('lexio-prod-482910');
    expect(body.error.code).toBe('unknown');
  });
});
