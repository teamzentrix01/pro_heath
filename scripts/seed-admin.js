const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const databaseUrlMatch = envContent.match(/^DATABASE_URL=(.+)$/m);

if (!databaseUrlMatch) {
  console.error('DATABASE_URL not found in .env.local');
  process.exit(1);
}

const adminLogin = process.env.ADMIN_LOGIN_ID || 'admin@123';
const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
const adminName = process.env.ADMIN_FULL_NAME || 'Admin';
const adminPhone = process.env.ADMIN_PHONE_NUMBER || '9999999999';

const normalizeDatabaseUrl = (url) => {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete('sslmode');
    parsed.searchParams.delete('channel_binding');
    parsed.searchParams.delete('sslcert');
    parsed.searchParams.delete('sslkey');
    parsed.searchParams.delete('sslrootcert');
    return parsed.toString();
  } catch {
    return url;
  }
};

const shouldUseSsl = (url) => {
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.get('sslmode') === 'require') return true;
    return !['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
  } catch {
    return true;
  }
};

const pool = new Pool({
  connectionString: normalizeDatabaseUrl(databaseUrlMatch[1].trim()),
  ssl: shouldUseSsl(databaseUrlMatch[1].trim()) ? { rejectUnauthorized: false } : false,
});

(async () => {
  try {
    console.log('Applying schema if needed...');
    const schemaSql = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
    await pool.query(schemaSql);

    console.log(`Upserting admin account: ${adminLogin}`);
    await pool.query(
      `INSERT INTO app_users (
         login_id,
         email,
         password_hash,
         full_name,
         phone_number,
         role,
         admin_created,
         is_active
       )
       VALUES (
         LOWER($1),
         LOWER($1),
         crypt($2, gen_salt('bf')),
         $3,
         $4,
         'admin',
         TRUE,
         TRUE
       )
       ON CONFLICT (LOWER(email))
       WHERE email IS NOT NULL
       DO UPDATE SET
         login_id = LOWER(EXCLUDED.email),
         password_hash = EXCLUDED.password_hash,
         full_name = EXCLUDED.full_name,
         phone_number = EXCLUDED.phone_number,
         role = 'admin',
         admin_created = TRUE,
         is_active = TRUE,
         updated_at = NOW()`,
      [adminLogin, adminPassword, adminName, adminPhone]
    );

    console.log('Admin account is ready.');
    console.log(`Login ID: ${adminLogin}`);
    console.log(`Password: ${adminPassword}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
