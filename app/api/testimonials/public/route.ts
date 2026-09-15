import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { testimonials } from '@/lib/db/schema';
import { eq, sql, asc, and } from 'drizzle-orm';
import { success, serverError } from '@/lib/utils/api-response';
import { logger } from '@/lib/utils/logger';
import { withRateLimit } from '@/lib/utils/rate-limit';
export const revalidate = 300;
export const runtime = 'nodejs';

export const GET = withRateLimit(async (req: NextRequest) => {
  try {
    const data = await db.query.testimonials.findMany({
      where: and(eq(testimonials.isActive, true), sql`${testimonials.deletedAt} IS NULL`),
      orderBy: [asc(testimonials.sortOrder), asc(testimonials.createdAt)],
      // Defensive cap: testimonials are curated (dozens), but an unbounded
      // public query is a footgun if the table ever grows.
      limit: 100,
    });

    return NextResponse.json(
      { success: true, data },
      {
        headers: {
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (error) {
    // serverError() logs centrally — single structured line.
    logger.error('[api/testimonials/public]', { error: error instanceof Error ? error.message : String(error) });
    return serverError(error);
  }
}, 'public');