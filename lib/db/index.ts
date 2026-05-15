import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';
import { requireEnv } from '@/lib/config/validate-env';

// Validate required env vars on startup (only in production)
if (process.env.NODE_ENV === 'production') {
  requireEnv();
}

// Infer the db type from drizzle call
type DbType = ReturnType<typeof drizzle<typeof schema>>;

let _db: DbType | null = null;

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  return url;
}

function getDb(): DbType {
  if (!_db) {
    const sql = neon(getDatabaseUrl());
    _db = drizzle(sql, { schema });
  }
  return _db;
}

// Named export — use this in API routes and server components
export const db: DbType = getDb();