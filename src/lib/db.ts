import { Pool, PoolClient, QueryResultRow } from 'pg';

const connectionString = process.env.DATABASE_URL;

const normalizedConnectionString = (() => {
  if (!connectionString) return undefined;
  try {
    const url = new URL(connectionString);
    // SSL is configured explicitly below. Removing this avoids pg's upcoming
    // sslmode semantic-change warning while preserving encrypted connections.
    url.searchParams.delete('sslmode');
    url.searchParams.delete('uselibpqcompat');
    return url.toString();
  } catch {
    return connectionString;
  }
})();

const shouldUseSsl = (() => {
  if (!connectionString) return false;
  try {
    const url = new URL(connectionString);
    const sslMode = url.searchParams.get('sslmode');
    if (sslMode === 'require') return true;
    return !['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  } catch {
    return true;
  }
})();

if (!connectionString) {
  console.warn('DATABASE_URL is not set. PostgreSQL API routes will fail until it is configured.');
}

const globalForPg = globalThis as unknown as {
  pgPool?: Pool;
  pgErrorHandlerAttached?: boolean;
};

export const pool =
  globalForPg.pgPool ??
  new Pool({
    connectionString: normalizedConnectionString,
    ssl: shouldUseSsl ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 5_000,
  });

if (!globalForPg.pgErrorHandlerAttached) {
  pool.on('error', (error) => {
    // pg removes broken idle clients automatically. Logging here prevents an
    // unhandled pool error and the next query receives a fresh connection.
    console.error('PostgreSQL idle connection was reset:', error.message);
  });
  globalForPg.pgErrorHandlerAttached = true;
}

if (process.env.NODE_ENV !== 'production') {
  globalForPg.pgPool = pool;
}

const RETRYABLE_DATABASE_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
  '08000',
  '08003',
  '08006',
  '57P01',
  '57P02',
  '57P03',
]);

const isRetryableDatabaseError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error ? String(error.code) : '';
  return RETRYABLE_DATABASE_CODES.has(code);
};

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export const dbQuery = async <Row extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: unknown[]
) => {
  try {
    return await pool.query<Row>(text, values);
  } catch (error) {
    if (!isRetryableDatabaseError(error)) throw error;
    await wait(150);
    return pool.query<Row>(text, values);
  }
};

export const getDbClient = async (): Promise<PoolClient> => {
  try {
    return await pool.connect();
  } catch (error) {
    if (!isRetryableDatabaseError(error)) throw error;
    await wait(150);
    return pool.connect();
  }
};
