import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { testimonials } from '@/lib/db/schema';
import { eq, sql, and } from 'drizzle-orm';
import { success, created, unauthorized, forbidden, notFound, validationError, serverError } from '@/lib/utils/api-response';
import { z } from 'zod';

const testimonialSchema = z.object({
  customerName: z.string().min(1).max(100),
  customerLocation: z.string().max(100).optional(),
  avatarUrl: z.string().url().optional().nullable(),
  rating: z.number().int().min(1).max(5),
  contentId: z.string().min(1),
  contentEn: z.string().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
});

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !['superadmin', 'owner'].includes(session.user.role ?? '')) {
      return forbidden('Akses ditolak');
    }

    const searchParams = req.nextUrl.searchParams;
    const activeOnly = searchParams.get('active') === 'true';

    const whereClause = activeOnly
      ? and(eq(testimonials.isActive, true), sql`${testimonials.deletedAt} IS NULL`)
      : sql`${testimonials.deletedAt} IS NULL`;

    const data = await db.query.testimonials.findMany({
      where: whereClause,
      orderBy: (t, { asc }) => [asc(t.sortOrder), asc(t.createdAt)],
    });

    return success(data);
  } catch (error) {
    console.error('[admin/testimonials GET]', error);
    return serverError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !['superadmin', 'owner'].includes(session.user.role ?? '')) {
      return forbidden('Akses ditolak');
    }

    const body = await req.json();
    const parsed = testimonialSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const [created_] = await db.insert(testimonials).values({
      ...parsed.data,
      customerLocation: parsed.data.customerLocation ?? null,
      avatarUrl: parsed.data.avatarUrl ?? null,
      contentEn: parsed.data.contentEn ?? null,
    }).returning();

    return created(created_);
  } catch (error) {
    console.error('[admin/testimonials POST]', error);
    return serverError(error);
  }
}