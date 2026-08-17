import 'server-only';
import { escapeHtml } from '@/lib/api/html-escape';

/**
 * Shared between the interactive "send test email" route
 * (app/api/gmail/send-reminder/route.ts) and the automated cron route
 * (app/api/cron/send-reminders/route.ts) — same email, same RFC 2822
 * encoding, two different triggers. Keeping the HTML/MIME building in one
 * place means a change to the template or the header-injection guard only
 * has to happen once.
 */
export interface ReminderWord {
  word: string;
  meaningVi: string;
  exampleSentence?: string;
  ipa?: string;
}

/** Same cap the interactive route's zod schema enforces (`.max(20)`) — kept
 * here too so the cron path (which builds its own word list, no zod in the
 * loop) can't accidentally hand Gmail an oversized digest. */
export const MAX_REMINDER_WORDS = 20;

function renderWordsHtml(words: ReminderWord[]): string {
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

function renderHtmlBody(words: ReminderWord[], appUrl: string): string {
  return `
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
          ${renderWordsHtml(words)}
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
}

/** Builds the base64url-encoded RFC 2822 message `gmail.users.messages.send`
 * expects in `requestBody.raw`. `to` must already be validated (no CR/LF —
 * see the header-injection comment on `Recipient` in the interactive route;
 * the cron route's recipient always comes from Gmail's own OAuth userinfo,
 * never user input, so it doesn't need re-validating here). */
export function buildReminderRawMessage(params: { to: string; words: ReminderWord[]; appUrl: string }): string {
  const { to, words, appUrl } = params;
  const subject = `Lexio — ${words.length} từ vựng ôn tập hôm nay`;
  // Encoded UTF-8 Subject for RFC 2822 header
  const encodedSubject = `=?utf-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`;

  const message = [
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    renderHtmlBody(words, appUrl),
  ].join('\r\n');

  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
