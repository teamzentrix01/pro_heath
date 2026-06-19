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

console.log('Connecting to database...');
const pool = new Pool({
  connectionString: dbUrl,
  ssl: {
    rejectUnauthorized: false
  }
});

(async () => {
  try {
    console.log('Checking connection...');
    const nowResult = await pool.query('SELECT NOW()');
    console.log('Connected! Current DB time:', nowResult.rows[0].now);

    console.log('Dropping role check constraint if exists...');
    await pool.query('ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_role_check');

    console.log('Updating user roles to pro...');
    const updateResult = await pool.query("UPDATE app_users SET role = 'pro' WHERE role = 'user'");
    console.log('Updated rows:', updateResult.rowCount);

    console.log('Adding new role check constraint...');
    await pool.query("ALTER TABLE app_users ADD CONSTRAINT app_users_role_check CHECK (role IN ('admin', 'pro'))");

    console.log('Applying the current application schema...');
    const schemaSql = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
    await pool.query(schemaSql);

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
