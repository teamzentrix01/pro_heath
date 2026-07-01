import { dbQuery, getDbClient } from '@/lib/db';
import { randomBytes } from 'crypto';
import { hashSessionToken, SESSION_DURATION_SECONDS } from '@/lib/auth';
import { AppUser, UserRole } from '@/types/users';

type UserRow = {
  id: string;
  email: string;
  full_name: string | null;
  phone_number: string | null;
  role: UserRole;
  created_by_user_id: string | null;
  is_active: boolean;
  login_count: number;
  submission_count: number;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

const mapUser = (row: UserRow): AppUser => ({
  id: row.id,
  email: row.email,
  fullName: row.full_name ?? '',
  phoneNumber: row.phone_number ?? '',
  role: row.role,
  createdByUserId: row.created_by_user_id,
  isActive: row.is_active,
  loginCount: row.login_count,
  submissionCount: row.submission_count,
  lastLoginAt: row.last_login_at?.toISOString() ?? null,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

const userColumns = `
  id,
  email,
  full_name,
  phone_number,
  role,
  created_by_user_id,
  is_active,
  login_count,
  (
    SELECT COUNT(*)::int
    FROM form_submissions fs
    WHERE fs.user_id = app_users.id
  ) AS submission_count,
  last_login_at,
  created_at,
  updated_at
`;

export const createUser = async (input: {
  email: string;
  password: string;
  fullName: string;
  phoneNumber: string;
  role?: 'pro' | 'doctor';
  createdByUserId?: string | null;
}) => {
  const result = await dbQuery<UserRow>(
    `INSERT INTO app_users (
       login_id,
       email,
       password_hash,
       full_name,
       phone_number,
       role,
       admin_created,
       created_by_user_id
     )
     VALUES (LOWER($1), LOWER($1), crypt($2, gen_salt('bf')), $3, $4, $5, TRUE, $6)
     RETURNING ${userColumns}`,
    [input.email, input.password, input.fullName, input.phoneNumber, input.role ?? 'pro', input.createdByUserId ?? null]
  );

  return mapUser(result.rows[0]);
};

export const authenticateUser = async (input: {
  email: string;
  password: string;
  ipAddress: string | null;
  userAgent: string | null;
}) => {
  const client = await getDbClient();
  const sessionToken = randomBytes(32).toString('hex');

  try {
    await client.query('BEGIN');

    const result = await client.query<UserRow>(
      `UPDATE app_users
       SET
         login_count = login_count + 1,
         last_login_at = NOW(),
         last_login_ip = $3::inet,
         last_user_agent = $4,
         updated_at = NOW()
       WHERE (LOWER(email) = LOWER($1) OR phone_number = $1)
         AND admin_created = TRUE
         AND is_active = TRUE
         AND password_hash = crypt($2, password_hash)
       RETURNING ${userColumns}`,
      [input.email, input.password, input.ipAddress, input.userAgent]
    );

    if (!result.rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }

    await client.query(
      `INSERT INTO user_login_events (user_id, email, ip_address, user_agent)
       VALUES ($1, $2, $3::inet, $4)`,
      [result.rows[0].id, result.rows[0].email, input.ipAddress, input.userAgent]
    );

    await client.query(
      `INSERT INTO auth_sessions (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + ($3 * INTERVAL '1 second'))`,
      [result.rows[0].id, hashSessionToken(sessionToken), SESSION_DURATION_SECONDS]
    );

    await client.query('COMMIT');
    return { user: mapUser(result.rows[0]), sessionToken };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const listUsers = async () => {
  const result = await dbQuery<UserRow>(
    `SELECT ${userColumns}
     FROM app_users
     WHERE email IS NOT NULL
       AND admin_created = TRUE
     ORDER BY created_at DESC`
  );

  return result.rows.map(mapUser);
};

export const listDoctors = async (proId?: string) => {
  const result = await dbQuery<UserRow>(
    `SELECT ${userColumns}
     FROM app_users
     WHERE role = 'doctor'
       AND admin_created = TRUE
       AND ($1::uuid IS NULL OR created_by_user_id = $1)
     ORDER BY created_at DESC`,
    [proId ?? null]
  );
  return result.rows.map(mapUser);
};

export const getUserById = async (id: string) => {
  const result = await dbQuery<UserRow>(
    `SELECT ${userColumns}
     FROM app_users
     WHERE id = $1
     LIMIT 1`,
    [id]
  );

  return result.rows[0] ? mapUser(result.rows[0]) : null;
};

export const updateUserProfile = async (
  id: string,
  input: { fullName: string; phoneNumber: string; currentPassword?: string; newPassword?: string }
) => {
  const result = await dbQuery<UserRow>(
    `UPDATE app_users
     SET
       full_name = $2,
       phone_number = $3,
       password_hash = CASE
         WHEN $5::text IS NULL THEN password_hash
         ELSE crypt($5, gen_salt('bf'))
       END,
       updated_at = NOW()
     WHERE id = $1
       AND (
         $5::text IS NULL
         OR password_hash = crypt($4, password_hash)
       )
     RETURNING ${userColumns}`,
    [
      id,
      input.fullName,
      input.phoneNumber,
      input.currentPassword ?? null,
      input.newPassword ?? null,
    ]
  );

  return result.rows[0] ? mapUser(result.rows[0]) : null;
};

export const changeUserPassword = async (id: string, currentPassword: string, newPassword: string) => {
  const result = await dbQuery<{ id: string }>(
    `UPDATE app_users
     SET password_hash = crypt($3, gen_salt('bf')), updated_at = NOW()
     WHERE id = $1 AND password_hash = crypt($2, password_hash)
     RETURNING id`,
    [id, currentPassword, newPassword]
  );
  return Boolean(result.rowCount);
};

export const resetUserPassword = async (id: string, newPassword: string) => {
  const client = await getDbClient();
  try {
    await client.query('BEGIN');
    const result = await client.query<{ id: string }>(
      `UPDATE app_users
       SET password_hash = crypt($2, gen_salt('bf')), updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [id, newPassword]
    );
    if (result.rowCount) {
      await client.query(`DELETE FROM auth_sessions WHERE user_id = $1`, [id]);
    }
    await client.query('COMMIT');
    return Boolean(result.rowCount);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
