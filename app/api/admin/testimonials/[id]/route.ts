import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { testimonials } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { success, unauthorized, forbidden, notFound, validationError, serverError } from '@/lib/utils/api-response';
import { z } from 'zod';

const updateSchema = z.object({
  customerName: z.string().min(1).max(100).optional(),
  customerLocation: z.string().max(100).optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
  rating: z.number().int().min(1).max(5).optional(),
  contentId: z.string().min(1).optional(),
  contentEn: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || !['superadmin', 'owner'].includes(session.user.role ?? '')) {
      return forbidden('Akses ditolak');
    }

    const { id } = await params;
    const data = await db.query.testimonials.findFirst({
      where: eq(testimonials.id, id),
    });

    if (!data) return notFound('Testimonial tidak ditemukan');
    return success(data);
  } catch (error) {
    console.error('[admin/testimonials/[id] GET]', error);
    return serverError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || !['superadmin', 'owner'].includes(session.user.role ?? '')) {
      return forbidden('Akses ditolak');
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const [updated] = await db
      .update(testimonials)
      .set(parsed.data)
      .where(eq(testimonials.id, id))
      .returning();

    if (!updated) return notFound('Testimonial tidak ditemukan');
    return success(updated);
  } catch (error) {
    console.error('[admin/testimonials/[id] PATCH]', error);
    return serverError(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || !['superadmin', 'owner'].includes(session.user.role ?? '')) {
      return forbidden('Akses ditolak');
    }

    const { id } = await params;
    const [deleted] = await db
      .update(testimonials)
      .set({ deletedAt: new Date() })
      .where(eq(testimonials.id, id))
      .returning();

    if (!deleted) return notFound('Testimonial tidak ditemukan');
    return success({ deleted: true });
  } catch (error) {
    console.error('[admin/testimonials/[id] DELETE]', error);
    return serverError(error);
  }
}