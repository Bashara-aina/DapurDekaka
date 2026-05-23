import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

type DbType = ReturnType<typeof drizzle<typeof schema>>;

// Use globalThis to persist db instance across module reloads (HMR, etc.)
const g = globalThis as { __db?: DbType };

function createDb(): DbType {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL environment variable is not set');
  const sql = neon(url);
  return drizzle(sql, { schema });
}

function getDb(): DbType {
  if (!g.__db) {
    g.__db = createDb();
  }
  return g.__db;
}

export const db = getDb();