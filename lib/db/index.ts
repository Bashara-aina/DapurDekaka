import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from './schema';

type DbType = ReturnType<typeof drizzle<typeof schema>>;

// P0 FIX (audit #47): the previous driver (`drizzle-orm/neon-http`) THROWS
// "No transactions support in neon-http driver" on every db.transaction() —
// 30 call sites (checkout, webhooks, cron, admin) were broken at runtime.
// `neon-serverless` Pool supports real interactive transactions (row locks,
// FOR UPDATE, multi-statement atomicity) over WebSocket. All API routes run
// on Node.js by default, so Pool is safe there; the single Edge caller
// (middleware → isMaintenanceMode) is guarded with try/catch + env fallback.
// (No fetchConnectionCache flag: @neondatabase/serverless ≥0.10 enables
// connection caching unconditionally; setting it logs a deprecation warning.)
// Singleton Pool — created once and reused across HMR reloads and
// serverless invocations (Neon docs: never pool-per-request).
let _pool: Pool | null = null;
let _db: DbType | null = null;

function dbUrl(): string | undefined {
  // Empty-string env values (shadowed .env* keys) count as missing.
  return process.env.DATABASE_URL?.trim() || process.env.DATABASE_URL_UNPOOLED?.trim() || undefined;
}

/** True when a database URL is configured (false during env-less builds). */
export function hasDbUrl(): boolean {
  return dbUrl() !== undefined;
}

function getPool(): Pool {
  const url = dbUrl();
  if (!url) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  if (!_pool) {
    _pool = new Pool({ connectionString: url });
  }
  return _pool;
}

function getDb(): DbType {
  if (!_db) {
    _db = drizzle(getPool(), { schema });
  }
  return _db;
}

// Export the singleton — no Proxy, avoids infinite recursion during route collection
export { getDb };
// Lazy proxy: defers getDb() (and its env throw) until the first property access,
// so importing route modules during build/collect never crashes on missing env.
export const db: DbType = new Proxy({} as DbType, {
  get(_target, prop) {
    const value = Reflect.get(getDb() as unknown as Record<PropertyKey, unknown>, prop);
    // Bind methods so `this` inside drizzle client never points at the proxy.
    return typeof value === 'function' ? (value as Function).bind(getDb()) : value;
  },
  has(_target, prop) {
    return Reflect.has(getDb() as unknown as object, prop);
  },
});