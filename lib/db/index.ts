import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

// ─────────────────────────────────────────
// Supabase connection via direct pg
// Note: Requires Supabase pgBouncer/Direct access enabled
// If db.uebtatnblmsuldnyrixv.supabase.co is unreachable from your network,
// use the Supabase MCP execute_sql tool for all operations instead.
// ─────────────────────────────────────────

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: Pool | null = null;

function getPool(): Pool {
  if (!_pool) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    _pool = new Pool({
      connectionString: url,
      ssl: {
        rejectUnauthorized: false,
      },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return _pool;
}

function getDb() {
  if (!_db) {
    _db = drizzle(getPool(), { schema });
  }
  return _db;
}

export function getPoolExporter(): Pool {
  return getPool();
}

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    return (getDb() as any)[prop];
  },
});

export async function closePool() {
  if (_pool) {
    await _pool.end();
    _pool = null;
    _db = null;
  }
}