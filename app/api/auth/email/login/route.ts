import { NextRequest, NextResponse } from 'next/server';
import { setUserSession } from '@/lib/auth/user-session';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, name } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: 'invalid_email', message: 'Vui lòng nhập địa chỉ email hợp lệ.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const displayName = name && typeof name === 'string' ? name.trim() : cleanEmail.split('@')[0];

    // Create and save session cookie
    const session = {
      email: cleanEmail,
      name: displayName,
      loginMethod: 'email' as const,
      createdAt: Date.now(),
    };

    await setUserSession(session);

    return NextResponse.json({
      success: true,
      user: {
        email: cleanEmail,
        name: displayName,
      },
      message: 'Đăng nhập bằng email thành công!',
    });
  } catch (err) {
    console.error('Email login error:', err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: 'server_error', message: 'Lỗi hệ thống khi đăng nhập email.' },
      { status: 500 }
    );
  }
}
