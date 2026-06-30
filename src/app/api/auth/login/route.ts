import { authenticateUser } from '@/lib/users';
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, SESSION_DURATION_SECONDS } from '@/lib/auth';
import { isDatabaseUnavailableError } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    const forwardedFor = request.headers.get('x-forwarded-for');
    const ipAddress = forwardedFor?.split(',')[0]?.trim() || null;
    const authenticated = await authenticateUser({
      email,
      password,
      ipAddress,
      userAgent: request.headers.get('user-agent'),
    });

    if (!authenticated) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const response = NextResponse.json({ user: authenticated.user });
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: authenticated.sessionToken,
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_DURATION_SECONDS,
    });

    return response;
  } catch (error) {
    console.error(error);
    if (isDatabaseUnavailableError(error)) {
      return NextResponse.json(
        {
          error:
            'Login service is temporarily unavailable because the database has reached its capacity limit. Please contact the administrator.',
          code: 'DATABASE_UNAVAILABLE',
        },
        {
          status: 503,
          headers: { 'Retry-After': '300' },
        }
      );
    }

    return NextResponse.json({ error: 'Unable to log in.' }, { status: 500 });
  }
}
