import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

// Infer the db type from drizzle call
type DbType = ReturnType<typeof drizzle<typeof schema>>;

// Singleton pool — initialized on first use
let _pool: Pool | null = null;
let _db: DbType | null = null;

function getPool(): Pool {
  if (!_pool) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    _pool = new Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return _pool;
}

function getDb(): DbType {
  if (!_db) {
    _db = drizzle(getPool(), { schema });
  }
  return _db;
}

// Named export — use this in API routes and server components
export const db: DbType = getDb();

// Pool accessor for scripts that need explicit close
export function getPoolExporter(): Pool {
  return getPool();
}

// For graceful shutdown
export async function closePool(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
    _db = null;
  }
}