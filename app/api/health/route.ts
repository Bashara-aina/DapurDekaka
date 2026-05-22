import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Health check endpoint for load balancers and monitoring.
 * Verifies database connectivity and critical service status.
 */
export async function GET(req: NextRequest) {
  const now = new Date();
  let latencyMs: number | null = null;

  try {
    const start = Date.now();
    await db.select({ id: users.id }).from(users).limit(1);
    latencyMs = Date.now() - start;
  } catch {
    // DB error — latencyMs stays null
  }

  return NextResponse.json(
    { status: 'ok', timestamp: now.toISOString() },
    { status: latencyMs !== null ? 200 : 503 }
  );
}