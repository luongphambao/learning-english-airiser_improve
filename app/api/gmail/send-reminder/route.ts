import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getOAuth2Client, getStoredTokens, setStoredTokens } from '@/lib/auth/google';

interface SimpleWord {
  word: string;
  meaningVi: string;
  exampleSentence?: string;
  ipa?: string;
}

export async function POST(req: NextRequest) {
  try {
    const origin = req.nextUrl.origin;
    const tokens = await getStoredTokens();

    if (!tokens || (!tokens.access_token && !tokens.refresh_token)) {
      return NextResponse.json(
        { error: 'gmail_not_connected', message: 'Vui lòng kết nối tài khoản Gmail trong Cài đặt.' },
        { status: 401 }
      );
    }

    const oauth2Client = getOAuth2Client(origin);
    oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
    });

    // Listen for refreshed tokens
    oauth2Client.on('tokens', (newTokens) => {
      setStoredTokens({
        access_token: newTokens.access_token ?? tokens.access_token,
        refresh_token: newTokens.refresh_token ?? tokens.refresh_token,
        expiry_date: newTokens.expiry_date ?? tokens.expiry_date,
        email: tokens.email,
      });
    });

    let bodyWords: SimpleWord[] = [];
    let customRecipient: string | undefined;

    try {
      const body = await req.json();
      if (Array.isArray(body.words) && body.words.length > 0) {
        bodyWords = body.words;
      }
      if (typeof body.recipient === 'string' && body.recipient.trim()) {
        customRecipient = body.recipient.trim();
      }
    } catch {
      // Body empty or invalid JSON, use defaults
    }

    // Default sample words matching design doc #17 if none provided
    const words: SimpleWord[] = bodyWords.length > 0 ? bodyWords : [
      {
        word: 'constitute',
        meaningVi: 'tạo thành, cấu thành',
        exampleSentence: 'These species constitute nearly half of the reef\'s biomass.',
        ipa: '/ˈkɒnstɪtjuːt/',
      },
      {
        word: 'throughput',
        meaningVi: 'lượng việc xử lý trong một đơn vị thời gian',
        exampleSentence: 'Batching doubled our throughput without new hardware.',
        ipa: '/ˈθruːpʊt/',
      },
      {
        word: 'leverage',
        meaningVi: 'tận dụng để tạo lợi thế',
        exampleSentence: 'We can leverage existing infrastructure for this.',
        ipa: '/ˈliːvərɪdʒ/',
      },
    ];

    const recipient = customRecipient || tokens.email || 'me';
    const appUrl = origin || 'http://localhost:3000';

    const wordsHtml = words
      .map(
        (w) => `
        <div style="padding: 16px 0; border-bottom: 1px solid #E5DFD6;">
          <div style="font-family: Georgia, 'Times New Roman', serif; font-size: 24px; color: #232120; font-weight: bold;">
            ${w.word} <span style="font-size: 13px; font-weight: normal; color: #6B655E; font-family: monospace;">${w.ipa || ''}</span>
          </div>
          <div style="font-size: 14px; color: #232120; margin-top: 4px; line-height: 1.5;">
            <strong>${w.meaningVi}</strong>
          </div>
          ${
            w.exampleSentence
              ? `<div style="font-size: 13px; color: #6B655E; margin-top: 4px; font-style: italic;">
                  "${w.exampleSentence}"
                </div>`
              : ''
          }
        </div>
      `
      )
      .join('');

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
            ${wordsHtml}
          </div>

          <div style="margin-top: 28px; text-align: center;">
            <a href="${appUrl}/today" style="display: inline-block; background-color: #2F6B4F; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; padding: 14px 28px; border-radius: 12px; box-shadow: 0 2px 4px rgba(47,107,79,0.2);">
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

    const messageParts = [
      `To: ${recipient}`,
      `Subject: ${encodedSubject}`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      '',
      htmlBody,
    ];

    const message = messageParts.join('\r\n');
    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });

    return NextResponse.json({
      success: true,
      messageId: res.data.id,
      recipient: recipient === 'me' ? tokens.email : recipient,
      wordCount: words.length,
    });
  } catch (err: unknown) {
    console.error('Gmail send error:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'gmail_send_failed', message: msg },
      { status: 500 }
    );
  }
}
