import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const sendMock = vi.fn();
const findUidsMock = vi.fn();
const getDueWordsMock = vi.fn();
const getTokensMock = vi.fn();
const setTokensMock = vi.fn();

vi.mock('googleapis', () => ({
  google: {
    gmail: () => ({ users: { messages: { send: sendMock } } }),
  },
}));

vi.mock('@/lib/auth/google', () => ({
  getOAuth2Client: () => ({ setCredentials: vi.fn(), on: vi.fn() }),
  resolveOrigin: () => 'https://lexio.example.com',
}));

vi.mock('@/lib/reminders/store', () => ({
  findUidsWithReminderHour: (...args: unknown[]) => findUidsMock(...args),
  getDueWordsForUser: (...args: unknown[]) => getDueWordsMock(...args),
  getGmailTokensForUser: (...args: unknown[]) => getTokensMock(...args),
  setGmailTokensForUser: (...args: unknown[]) => setTokensMock(...args),
}));

const { POST } = await import('../send-reminders/route');

/** Decodes the base64url RFC 2822 message the route handed to the Gmail API. */
function sentMessage(): string {
  const raw = sendMock.mock.calls.at(-1)![0].requestBody.raw as string;
  return Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

function post(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost:3000/api/cron/send-reminders', { method: 'POST', headers });
}

// 08:00 in Asia/Ho_Chi_Minh (UTC+7) on 2026-08-17 == 01:00 UTC that same day.
const NOW = Date.UTC(2026, 7, 17, 1, 0, 0);
const WORD = { word: 'throughput', meaningVi: 'thông lượng' };

beforeEach(() => {
  process.env.CRON_SECRET = 'test-secret';
  vi.spyOn(Date, 'now').mockReturnValue(NOW);

  sendMock.mockReset();
  sendMock.mockResolvedValue({ data: { id: 'msg_1' } });
  findUidsMock.mockReset();
  findUidsMock.mockResolvedValue(['uid1']);
  getDueWordsMock.mockReset();
  getDueWordsMock.mockResolvedValue([WORD]);
  getTokensMock.mockReset();
  getTokensMock.mockResolvedValue({ access_token: 'tok', email: 'user@example.com', lastReminderDayKey: null });
  setTokensMock.mockReset();
  setTokensMock.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/cron/send-reminders', () => {
  it('rejects a request with no secret header', async () => {
    const res = await POST(post());
    expect(res.status).toBe(401);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('rejects a request with the wrong secret', async () => {
    const res = await POST(post({ 'x-cron-secret': 'wrong' }));
    expect(res.status).toBe(401);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('fails closed when CRON_SECRET is not configured, rather than accepting any header', async () => {
    delete process.env.CRON_SECRET;
    const res = await POST(post({ 'x-cron-secret': 'anything' }));
    expect(res.status).toBe(401);
  });

  it('resolves the current Asia/Ho_Chi_Minh hour and finds candidates for it', async () => {
    const res = await POST(post({ 'x-cron-secret': 'test-secret' }));
    expect(res.status).toBe(200);
    expect(findUidsMock).toHaveBeenCalledWith(8);
    const body = await res.json();
    expect(body.hourVN).toBe(8);
    expect(body.dayKeyVN).toBe('2026-08-17');
  });

  it('sends a reminder to a connected uid with due words, then marks today as sent', async () => {
    const res = await POST(post({ 'x-cron-secret': 'test-secret' }));
    const body = await res.json();

    expect(body.sent).toBe(1);
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(setTokensMock).toHaveBeenCalledWith('uid1', { lastReminderDayKey: '2026-08-17' });

    const message = sentMessage();
    expect(message).toContain('To: user@example.com');
    expect(message).toContain('throughput');
  });

  it('skips a uid with no Gmail tokens connected', async () => {
    getTokensMock.mockResolvedValue(null);
    const res = await POST(post({ 'x-cron-secret': 'test-secret' }));
    const body = await res.json();

    expect(body.skippedNotConnected).toBe(1);
    expect(body.sent).toBe(0);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('skips a uid already reminded today instead of double-sending', async () => {
    getTokensMock.mockResolvedValue({ access_token: 'tok', email: 'user@example.com', lastReminderDayKey: '2026-08-17' });
    const res = await POST(post({ 'x-cron-secret': 'test-secret' }));
    const body = await res.json();

    expect(body.skippedAlreadySentToday).toBe(1);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('skips a uid with no due words instead of sending an empty digest', async () => {
    getDueWordsMock.mockResolvedValue([]);
    const res = await POST(post({ 'x-cron-secret': 'test-secret' }));
    const body = await res.json();

    expect(body.skippedNoDueWords).toBe(1);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('counts a per-uid send failure without aborting the run or leaking the upstream error', async () => {
    findUidsMock.mockResolvedValue(['uid1', 'uid2']);
    sendMock.mockRejectedValueOnce(new Error('Quota exceeded for project lexio-prod-482910')).mockResolvedValueOnce({ data: { id: 'msg_2' } });

    const res = await POST(post({ 'x-cron-secret': 'test-secret' }));
    const body = await res.json();

    expect(body.failed).toBe(1);
    expect(body.sent).toBe(1);
    expect(JSON.stringify(body)).not.toContain('lexio-prod-482910');
  });
});
