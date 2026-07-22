import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';
export const runtime = 'nodejs';

/**
 * Health check endpoint for load balancers and monitoring.
 * Verifies database connectivity and critical service status.
 *
 * NOTE: This endpoint intentionally returns { status, checks, timestamp }
 * rather than the standard { success, data/error } format used by other API
 * routes. Monitoring tools (AWS ALB, Kubernetes liveness/readiness probes,
 * uptime monitors) expect a { status: 'healthy'|'unhealthy' } response
 * shape. The standard API response format would cause these tools to misidentify
 * healthy services as failing.
 */
export async function GET(_req: NextRequest) {
  let latencyMs: number | null = null;
  let errorMessage = '';

  try {
    const start = Date.now();
    await db.select({ id: users.id }).from(users).limit(1);
    latencyMs = Date.now() - start;
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  if (latencyMs !== null) {
    return NextResponse.json(
      {
        status: 'healthy',
        checks: { database: { status: 'ok', latency: latencyMs } },
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 's-maxage=60, stale-while-revalidate=30',
        },
      }
    );
  }

  return NextResponse.json(
    {
      status: 'unhealthy',
      error: 'Service unavailable',
      checks: { database: { status: 'error', error: 'Service unavailable', latency: null } },
      timestamp: new Date().toISOString(),
    },
    {
      status: 503,
      headers: {
        'Cache-Control': 's-maxage=0, must-revalidate',
      },
    }
  );
}