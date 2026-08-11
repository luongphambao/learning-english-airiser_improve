import { NextResponse } from 'next/server';
import { clearStoredTokens } from '@/lib/auth/google';

export async function POST() {
  await clearStoredTokens();
  return NextResponse.json({ success: true });
}
