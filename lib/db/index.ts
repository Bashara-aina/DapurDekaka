import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

type DbType = ReturnType<typeof drizzle<typeof schema>>;

const IS_BUILD =
  typeof process.env.NEXT_PHASE !== 'undefined' &&
  (process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.NEXT_PHASE === 'build');

// Use globalThis to persist db instance across module reloads (HMR, etc.)
const g = globalThis as { __db?: DbType };

function getDb(): DbType {
  if (IS_BUILD) return {} as DbType;
  if (!g.__db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL environment variable is not set');
    const sql = neon(url);
    g.__db = drizzle(sql, { schema });
  }
  return g.__db;
}

export const db = getDb();