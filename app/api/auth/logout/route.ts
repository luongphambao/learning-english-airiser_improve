import { NextResponse } from 'next/server';
import { clearUserSession } from '@/lib/auth/user-session';
import { clearStoredTokens } from '@/lib/auth/google';

export async function POST() {
  await clearUserSession();
  await clearStoredTokens();
  return NextResponse.json({ success: true, message: 'Đã đăng xuất thành công.' });
}
