import { SESSION_COOKIE_NAME, hashSessionToken } from '@/lib/auth';
import { dbQuery } from '@/lib/db';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    try {
      await dbQuery('DELETE FROM auth_sessions WHERE token_hash = $1', [
        hashSessionToken(token),
      ]);
    } catch (error) {
      // The local cookie must still be cleared if the database is unavailable.
      // The server-side session expires automatically and remains unusable
      // without its matching browser cookie.
      console.error('Unable to remove the server session during logout:', error);
    }
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    path: '/',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
  });
  return response;
}
