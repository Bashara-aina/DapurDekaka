import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;
neonConfig.poolTimeout = 10;
neonConfig.connectionTimeoutMillis = 5000;

// #region debug instrumentation
const DEBUG_SERVER = 'http://127.0.0.1:7810/ingest/48e4779b-a190-4144-bebe-5f691c4717c5';
const SESSION_ID = 'f5d4d3';
// #endregion

let pool: Pool | null = null;
let dbConnection: ReturnType<typeof drizzle> | null = null;

function createDbConnection(): ReturnType<typeof drizzle> | null {
  if (!process.env.DATABASE_URL) {
    console.error('[DB] DATABASE_URL not set - database features disabled');
    return null;
  }

  try {
    if (pool) {
      pool.end().catch(() => {});
    }

    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1,
      idleTimeoutMillis: 10000, // 10 seconds - aggressively close idle connections
      connectionTimeoutMillis: 5000,
    });
    dbConnection = drizzle({ client: pool, schema });
    console.log('[DB] Connection pool created successfully');
    fetch(DEBUG_SERVER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': SESSION_ID },
      body: JSON.stringify({ sessionId: SESSION_ID, runId: 'post-fix', location: 'db.ts:createDbConnection', message: 'pool_created', data: {}, timestamp: Date.now() })
    }).catch(() => {});

    pool.on('error', (err) => {
      console.error('[DB] Pool error:', err.message);
    });

    return dbConnection;
  } catch (error) {
    console.error('[DB] Failed to create connection pool:', error);
    return null;
  }
}

export function isNeonTerminationError(error: unknown): boolean {
  if (!error) return false;

  // Extract message from various error formats
  const msgs: string[] = [];

  if (error instanceof Error) {
    msgs.push(error.message);
    // Also check error.cause chain (Error causes)
    let cause: unknown = (error as unknown as { cause?: unknown }).cause;
    while (cause) {
      if (cause instanceof Error) {
        msgs.push(cause.message);
        cause = (cause as unknown as { cause?: unknown }).cause;
      } else if (typeof cause === 'string') {
        msgs.push(cause);
        break;
      } else if (cause && typeof cause === 'object' && 'message' in cause) {
        msgs.push(String((cause as { message: unknown }).message));
        break;
      } else {
        break;
      }
    }
    // Neon wraps errors with sourceError containing the real message
    const source = (error as unknown as { sourceError?: unknown }).sourceError;
    if (source instanceof Error) msgs.push(source.message);
    else if (typeof source === 'string') msgs.push(source);
    else if (source && typeof source === 'object' && 'message' in source) {
      msgs.push(String((source as { message: unknown }).message));
    }
  } else if (typeof error === 'string') {
    msgs.push(error);
  } else if (typeof error === 'object' && error !== null && 'message' in error) {
    msgs.push(String((error as { message: unknown }).message));
  } else {
    msgs.push(String(error));
  }

  const combined = msgs.join('|');
  return combined.includes('terminating connection due to administrator command') ||
         combined.includes('57P01') ||
         combined.includes('Connection terminated') ||
         combined.includes('Connection accidentally') ||
         combined.includes('SocketError') ||
         combined.includes('fetch failed') ||
         combined.includes('Connection terminated unexpectedly') ||
         combined.includes('Server closed the connection') ||
         combined.includes('Connection refused') ||
         combined.includes('getaddrinfo') ||
         combined.includes('ECONNREFUSED');
}

export function resetPool() {
  if (pool) {
    pool.end().catch(() => {});
    pool = null;
    dbConnection = null;
  }
  fetch(DEBUG_SERVER, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': SESSION_ID },
    body: JSON.stringify({ sessionId: SESSION_ID, runId: 'post-fix', location: 'db.ts:resetPool', message: 'pool_reset', data: {}, timestamp: Date.now() })
  }).catch(() => {});
}

export function getDb(): ReturnType<typeof drizzle> | null {
  if (!dbConnection) {
    return createDbConnection();
  }
  return dbConnection;
}

// Proxy getter so that existing `db` references get fresh connections
let _db: ReturnType<typeof drizzle> | null = null;
export function getDbProxy(): ReturnType<typeof drizzle> | null {
  return getDb();
}

export async function withNeonRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isNeonTerminationError(error)) {
      console.log('[DB] Neon connection termination, resetting and retrying...');
      resetPool();
      return await operation();
    }
    throw error;
  }
}

export const db = createDbConnection();
export { pool };