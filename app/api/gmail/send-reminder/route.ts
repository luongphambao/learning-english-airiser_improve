import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { z } from 'zod';
import { getOAuth2Client, getStoredTokens, setStoredTokens } from '@/lib/auth/google';
import { isAllowedOrigin, readBodyWithCap } from '@/lib/api/guards';
import { getRateLimiter, rateLimitKey } from '@/lib/api/rate-limit';
import { problemResponse } from '@/lib/api/problem';
import { buildReminderRawMessage } from '@/lib/gmail/render';

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

    const encodedMessage = buildReminderRawMessage({ to: recipient, words, appUrl });

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
