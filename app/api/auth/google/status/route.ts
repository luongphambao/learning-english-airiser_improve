import { NextResponse } from 'next/server';
import { getStoredTokens } from '@/lib/auth/google';

export async function GET() {
  const tokens = await getStoredTokens();
  if (!tokens || (!tokens.access_token && !tokens.refresh_token)) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    email: tokens.email || 'Google Account',
  });
}
