import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

type DbType = ReturnType<typeof drizzle<typeof schema>>;

// Singleton DB instance — created once and reused across module reloads (HMR, etc.)
let _db: DbType | null = null;

function getDb(): DbType {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    const sql = neon(url);
    _db = drizzle(sql, { schema });
  }
  return _db;
}

Object.defineProperty(globalThis, '__db', {
  get(): DbType {
    return getDb();
  },
  configurable: true,
});

// Export the singleton — no Proxy, avoids infinite recursion during route collection
export { getDb };
export const db: DbType = getDb();