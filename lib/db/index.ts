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

// Direct export - use this for DrizzleAdapter
export const db = getDb();