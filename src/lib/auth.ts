import { createHash } from 'crypto';
import { cookies } from 'next/headers';
import { pool } from '@/lib/db';
import { UserRole } from '@/types/users';

export const SESSION_COOKIE_NAME = 'health_track_session';
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

export const hashSessionToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

export const getAuthenticatedUser = async () => {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const result = await pool.query<{
    id: string;
    email: string;
    role: UserRole;
  }>(
    `SELECT au.id, au.email, au.role
     FROM auth_sessions session
     JOIN app_users au ON au.id = session.user_id
     WHERE session.token_hash = $1
       AND session.expires_at > NOW()
     LIMIT 1`,
    [hashSessionToken(token)]
  );

  return result.rows[0] ?? null;
};

export const requireAdmin = async () => {
  const user = await getAuthenticatedUser();
  return user?.role === 'admin' ? user : null;
};
