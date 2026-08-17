import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { z } from 'zod';
import { getOAuth2Client, getStoredTokens, setStoredTokens } from '@/lib/auth/google';
import { isAllowedOrigin, readBodyWithCap } from '@/lib/api/guards';
import { getRateLimiter, rateLimitKey } from '@/lib/api/rate-limit';
import { problemResponse } from '@/lib/api/problem';
import { escapeHtml } from '@/lib/api/html-escape';

const MAX_BODY_BYTES = 64 * 1024;
const RATE_LIMIT = { perMinute: 3, perDay: 20 };

// A recipient reaches an RFC 2822 header below, so a CR or LF in it would open a
// header-injection hole (Bcc to anywhere, from the user's real Gmail). zod's
// .email() already rejects both, and the explicit refine keeps that guarantee
// from silently depending on the validator's internals.
const Recipient = z
  .string()
  .trim()
  .max(254)
  .email()
  .refine((s) => !/[\r\n]/.test(s), 'recipient must not contain line breaks');

const ReminderWord = z.object({
  word: z.string().trim().min(1).max(80),
  meaningVi: z.string().trim().min(1).max(300),
  exampleSentence: z.string().trim().max(400).optional(),
  ipa: z.string().trim().max(80).optional(),
});

// `.min(1)` is load-bearing: this route used to fall back to three hard-coded
// demo words when the body was empty, which meant an empty notebook produced an
// email claiming those words were due for review.
const SendReminderInput = z.object({
  recipient: Recipient.optional(),
  words: z.array(ReminderWord).min(1).max(20),
});

type ReminderWord = z.infer<typeof ReminderWord>;

function renderWords(words: ReminderWord[]): string {
  return words
    .map((w) => {
      const ipa = w.ipa ? escapeHtml(w.ipa) : '';
      const example = w.exampleSentence
        ? `<div style="font-size: 13px; color: #6B655E; margin-top: 4px; font-style: italic;">
             "${escapeHtml(w.exampleSentence)}"
           </div>`
        : '';
      return `
        <div style="padding: 16px 0; border-bottom: 1px solid #E5DFD6;">
          <div style="font-family: Georgia, 'Times New Roman', serif; font-size: 24px; color: #232120; font-weight: bold;">
            ${escapeHtml(w.word)} <span style="font-size: 13px; font-weight: normal; color: #6B655E; font-family: monospace;">${ipa}</span>
          </div>
          <div style="font-size: 14px; color: #232120; margin-top: 4px; line-height: 1.5;">
            <strong>${escapeHtml(w.meaningVi)}</strong>
          </div>
          ${example}
        </div>
      `;
    })
    .join('');
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();

  if (!isAllowedOrigin(req)) {
    return problemResponse('forbidden_origin', requestId);
  }

  const body = await readBodyWithCap(req, MAX_BODY_BYTES);
  if (!body.ok) {
    return problemResponse('payload_too_large', requestId);
  }

  let raw: unknown;
  try {
    raw = body.text.length > 0 ? JSON.parse(body.text) : {};
  } catch {
    return problemResponse('bad_request', requestId);
  }

  const parsed = SendReminderInput.safeParse(raw);
  if (!parsed.success) {
    return problemResponse('invalid_input', requestId);
  }
  const { words, recipient: requestedRecipient } = parsed.data;

  const rl = await getRateLimiter().consume(rateLimitKey(req, 'gmail.send-reminder'), RATE_LIMIT);
  if (!rl.ok) {
    return problemResponse('rate_limited', requestId, {
      'retry-after': String(Math.ceil(rl.retryAfterMs / 1000)),
    });
  }

  const tokens = await getStoredTokens();
  if (!tokens || (!tokens.access_token && !tokens.refresh_token)) {
    return problemResponse('gmail_not_connected', requestId);
  }

  try {
    const origin = req.nextUrl.origin;
    const oauth2Client = getOAuth2Client(origin);
    oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
    });

    oauth2Client.on('tokens', (newTokens) => {
      setStoredTokens({
        access_token: newTokens.access_token ?? tokens.access_token,
        refresh_token: newTokens.refresh_token ?? tokens.refresh_token,
        expiry_date: newTokens.expiry_date ?? tokens.expiry_date,
        email: tokens.email,
      });
    });

    const recipient = requestedRecipient || tokens.email || 'me';
    const appUrl = origin || 'http://localhost:3000';

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Lexio — Nhắc nhở học từ vựng</title>
      </head>
      <body style="background-color: #FAF8F5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #232120; margin: 0; padding: 24px;">
        <div style="max-width: 480px; margin: 0 auto; background-color: #FFFFFF; border: 1px solid #E5DFD6; border-radius: 16px; padding: 28px 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">

          <div style="border-bottom: 1px solid #E5DFD6; padding-bottom: 16px; margin-bottom: 20px;">
            <div style="font-family: Georgia, serif; font-size: 28px; font-weight: bold; color: #2F6B4F; letter-spacing: -0.02em;">Lexio</div>
            <div style="font-size: 14px; color: #6B655E; margin-top: 4px; font-weight: 500;">${words.length} từ vựng cho bài ôn hôm nay</div>
          </div>

          <div>
            ${renderWords(words)}
          </div>

          <div style="margin-top: 28px; text-align: center;">
            <a href="${escapeHtml(appUrl)}/today" style="display: inline-block; background-color: #2F6B4F; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; padding: 14px 28px; border-radius: 12px; box-shadow: 0 2px 4px rgba(47,107,79,0.2);">
              Học 3 phút ngay
            </a>
          </div>

          <div style="margin-top: 28px; font-size: 11px; color: #6B655E; text-align: center; border-top: 1px solid #E5DFD6; padding-top: 16px;">
            Email tự động gửi từ ứng dụng Lexio qua Gmail API.<br>
            Bạn có thể quản lý cài đặt thông báo trong mục Cài đặt trên ứng dụng.
          </div>

        </div>
      </body>
      </html>
    `;

    const subject = `Lexio — ${words.length} từ vựng ôn tập hôm nay`;
    // Encoded UTF-8 Subject for RFC 2822 header
    const encodedSubject = `=?utf-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`;

    const message = [
      `To: ${recipient}`,
      `Subject: ${encodedSubject}`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      '',
      htmlBody,
    ].join('\r\n');

    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedMessage },
    });

    return NextResponse.json(
      {
        success: true,
        messageId: res.data.id,
        recipient: recipient === 'me' ? tokens.email : recipient,
        wordCount: words.length,
      },
      { headers: { 'x-request-id': requestId } },
    );
  } catch (err: unknown) {
    // googleapis errors carry project ids and quota details — logged, never returned.
    console.error('[lexio/gmail] send-reminder failed:', err instanceof Error ? err.message : String(err));
    return problemResponse('unknown', requestId);
  }
}
