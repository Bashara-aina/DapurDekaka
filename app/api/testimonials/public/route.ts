import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { testimonials } from '@/lib/db/schema';
import { eq, sql, asc, and } from 'drizzle-orm';
import { success, serverError } from '@/lib/utils/api-response';

export async function GET(_req: NextRequest) {
  try {
    const data = await db.query.testimonials.findMany({
      where: and(eq(testimonials.isActive, true), sql`${testimonials.deletedAt} IS NULL`),
      orderBy: [asc(testimonials.sortOrder), asc(testimonials.createdAt)],
    });

    return success(data);
  } catch (error) {
    console.error('[api/testimonials/public]', error);
    return serverError(error);
  }
}