import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('DATABASE_URL is not set. PostgreSQL API routes will fail until it is configured.');
}

const globalForPg = globalThis as unknown as {
  pgPool?: Pool;
};

export const pool =
  globalForPg.pgPool ??
  new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPg.pgPool = pool;
}