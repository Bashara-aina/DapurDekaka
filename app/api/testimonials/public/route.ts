import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { testimonials } from '@/lib/db/schema';
import { eq, sql, asc, and } from 'drizzle-orm';
import { success, serverError, badRequest } from '@/lib/utils/api-response';
import { checkRateLimitAsync } from '@/lib/utils/rate-limit';
export const revalidate = 300;
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const ip = req.ip || req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  const rateLimit = await checkRateLimitAsync(ip, 'public');
  if (!rateLimit.success) {
    return badRequest('Terlalu banyak permintaan. Silakan coba lagi nanti.');
  }

  try {
    const data = await db.query.testimonials.findMany({
      where: and(eq(testimonials.isActive, true), sql`${testimonials.deletedAt} IS NULL`),
      orderBy: [asc(testimonials.sortOrder), asc(testimonials.createdAt)],
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
    console.error('[api/testimonials/public]', error);
    return serverError(error);
  }
}