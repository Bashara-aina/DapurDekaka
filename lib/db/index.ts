import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

type DbType = ReturnType<typeof drizzle<typeof schema>>;

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  return url;
}

// Use globalThis to persist db instance across module reloads (HMR, etc.)
const g = globalThis as { __db?: DbType };

function getDb(): DbType {
  if (!g.__db) {
    const sql = neon(getDatabaseUrl());
    g.__db = drizzle(sql, { schema });
  }
  return g.__db;
}

// Export as a function to enable lazy initialization
// This prevents build-time initialization when DATABASE_URL is not set
// Usage: import { db } from '@/lib/db' → const database = db()
export const db: DbType = new Proxy({} as DbType, {
  get(_target, prop: string) {
    const instance = getDb();
    // Drizzle database object has methods that need to be bound
    const value = (instance as unknown as Record<string, unknown>)[prop];
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  },
});