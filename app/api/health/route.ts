import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

/**
 * Health check endpoint for load balancers and monitoring.
 * Verifies database connectivity and critical service status.
 */
export async function GET(_req: NextRequest) {
  let latencyMs: number | null = null;

  try {
    const start = Date.now();
    await db.select({ id: users.id }).from(users).limit(1);
    latencyMs = Date.now() - start;
  } catch {
    // DB error - latencyMs stays null
  }

  if (latencyMs !== null) {
    return NextResponse.json(
      {
        status: 'healthy',
        checks: { database: { status: 'ok', latency: latencyMs } },
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  }

  return NextResponse.json(
    {
      status: 'unhealthy',
      checks: { database: { status: 'error', latency: null } },
      timestamp: new Date().toISOString(),
    },
    { status: 503 }
  );
}