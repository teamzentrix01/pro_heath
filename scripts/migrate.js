const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Read .env.local
const envPath = path.join(__dirname, '..', '.env.local');
console.log('Reading env file from:', envPath);

let dbUrl = '';
try {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/^DATABASE_URL=(.+)$/m);
  if (match) {
    dbUrl = match[1].trim();
  }
} catch (e) {
  console.error('Failed to read env file:', e.message);
}

if (!dbUrl) {
  console.error('DATABASE_URL not found in .env.local');
  process.exit(1);
}

const normalizeDatabaseUrl = (url) => {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete('sslmode');
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

console.log('Connecting to database...');
const pool = new Pool({
  connectionString: normalizeDatabaseUrl(dbUrl),
  ssl: shouldUseSsl(dbUrl) ? { rejectUnauthorized: false } : false
});

(async () => {
  try {
    console.log('Checking connection...');
    const nowResult = await pool.query('SELECT NOW()');
    console.log('Connected! Current DB time:', nowResult.rows[0].now);

    console.log('Applying the current application schema...');
    const schemaSql = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
    await pool.query(schemaSql);

    console.log('Ensuring legacy user roles are migrated to pro...');
    const updateResult = await pool.query("UPDATE app_users SET role = 'pro' WHERE role = 'user'");
    console.log('Updated rows:', updateResult.rowCount);

    console.log('Database migration successfully completed!');
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    try {
      await pool.end();
    } catch (_) {}
    process.exit(1);
  }
})();
