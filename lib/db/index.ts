import type { NeonQueryFunction } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// Singleton pattern - only initialize when actually needed at runtime
let _db: ReturnType<typeof drizzle> | null = null;
let _sql: NeonQueryFunction<false, false> | null = null;

function getDb() {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      return null;
    }
    // Dynamic require to avoid build-time evaluation
    const { neon }: { neon: typeof import('@neondatabase/serverless').neon } = 
      require('@neondatabase/serverless');
    _sql = neon(url);
    _db = drizzle(_sql, { schema });
  }
  return _db;
}

// Get database instance, returning null if not yet initialized
export function getDatabase() {
  return getDb();
}

// Export db as a getter that lazily initializes
// This prevents build-time failures when DATABASE_URL isn't set
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    const database = getDb();
    if (!database) {
      return undefined;
    }
    return (database as any)[prop];
  },
});