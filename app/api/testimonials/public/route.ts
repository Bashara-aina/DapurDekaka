import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { testimonials } from '@/lib/db/schema';
import { eq, asc, isNull, and } from 'drizzle-orm';
import { success, serverError } from '@/lib/utils/api-response';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: NextRequest) {
  try {
    const rows = await db
      .select()
      .from(testimonials)
      .where(
        and(
          eq(testimonials.isActive, true),
          isNull(testimonials.deletedAt)
        )
      )
      .orderBy(asc(testimonials.sortOrder));

    return success({ testimonials: rows });
  } catch (error) {
    console.error('[testimonials/public]', error);
    return serverError(error);
  }
}