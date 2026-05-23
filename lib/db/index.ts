import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

type DbType = ReturnType<typeof drizzle<typeof schema>>;

// Use globalThis to persist db instance across module reloads (HMR, etc.)
const g = globalThis as { __db?: DbType };

function getDb(): DbType {
  if (!g.__db) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    const sql = neon(url);
    g.__db = drizzle(sql, { schema });
  }
  return g.__db;
}

// Lazy getter — db is only resolved on first access, not at module load time.
// This allows `next build` to succeed even when DATABASE_URL is not set locally.
Object.defineProperty(globalThis, '__db', {
  get(): DbType {
    return getDb();
  },
  configurable: true,
});

export const db: DbType = new Proxy({} as DbType, {
  get(_target, prop) {
    if (prop === 'then' || prop === 'catch') return undefined;
    return (getDb() as unknown as Record<string, unknown>)[prop as string];
  },
});