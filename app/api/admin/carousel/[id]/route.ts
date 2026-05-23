import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { carouselSlides } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { success, notFound, serverError, unauthorized, forbidden, validationError } from '@/lib/utils/api-response';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized('Silakan login terlebih dahulu');
    }
    if (!['superadmin', 'owner'].includes(session.user.role as string)) {
      return forbidden('Anda tidak memiliki akses');
    }

    const slide = await db.query.carouselSlides.findFirst({
      where: and(eq(carouselSlides.id, params.id), isNull(carouselSlides.deletedAt)),
    });

    if (!slide) {
      return notFound('Slide tidak ditemukan');
    }

    return success(slide);
  } catch (error) {
    console.error('[Admin Carousel GET:id]', error);
    return serverError(error);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized('Silakan login terlebih dahulu');
    }
    if (!['superadmin', 'owner'].includes(session.user.role as string)) {
      return forbidden('Anda tidak memiliki akses');
    }

    const body = await req.json();
    const schema = z.object({
      type: z.enum(['product_hero', 'promo', 'brand_story']).optional(),
      titleId: z.string().min(1).optional(),
      titleEn: z.string().min(1).optional(),
      subtitleId: z.string().optional(),
      subtitleEn: z.string().optional(),
      imageUrl: z.string().optional(),
      imagePublicId: z.string().optional(),
      ctaLabelId: z.string().optional(),
      ctaLabelEn: z.string().optional(),
      ctaUrl: z.string().optional(),
      badgeText: z.string().optional(),
      sortOrder: z.number().int().nonnegative().optional(),
      isActive: z.boolean().optional(),
      startsAt: z.string().datetime().optional().nullable(),
      endsAt: z.string().datetime().optional().nullable(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const existing = await db.query.carouselSlides.findFirst({
      where: and(eq(carouselSlides.id, params.id), isNull(carouselSlides.deletedAt)),
    });
    if (!existing) {
      return notFound('Slide tidak ditemukan');
    }

    const data = parsed.data;
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    
    if (data.type !== undefined) updateData.type = data.type;
    if (data.titleId !== undefined) updateData.titleId = data.titleId;
    if (data.titleEn !== undefined) updateData.titleEn = data.titleEn;
    if (data.subtitleId !== undefined) updateData.subtitleId = data.subtitleId;
    if (data.subtitleEn !== undefined) updateData.subtitleEn = data.subtitleEn;
    if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
    if (data.imagePublicId !== undefined) updateData.imagePublicId = data.imagePublicId;
    if (data.ctaLabelId !== undefined) updateData.ctaLabelId = data.ctaLabelId;
    if (data.ctaLabelEn !== undefined) updateData.ctaLabelEn = data.ctaLabelEn;
    if (data.ctaUrl !== undefined) updateData.ctaUrl = data.ctaUrl;
    if (data.badgeText !== undefined) updateData.badgeText = data.badgeText;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.startsAt !== undefined) updateData.startsAt = data.startsAt ? new Date(data.startsAt) : null;
    if (data.endsAt !== undefined) updateData.endsAt = data.endsAt ? new Date(data.endsAt) : null;

    const [updated] = await db
      .update(carouselSlides)
      .set(updateData)
      .where(eq(carouselSlides.id, params.id))
      .returning();

    return success(updated);
  } catch (error) {
    console.error('[Admin Carousel PUT]', error);
    return serverError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized('Silakan login terlebih dahulu');
    }
    if (!['superadmin', 'owner'].includes(session.user.role as string)) {
      return forbidden('Anda tidak memiliki akses');
    }

    const existing = await db.query.carouselSlides.findFirst({
      where: and(eq(carouselSlides.id, params.id), isNull(carouselSlides.deletedAt)),
    });
    if (!existing) {
      return notFound('Slide tidak ditemukan');
    }

    await db
      .update(carouselSlides)
      .set({ deletedAt: new Date() })
      .where(eq(carouselSlides.id, params.id));

    return success({ id: params.id });
  } catch (error) {
    console.error('[Admin Carousel DELETE]', error);
    return serverError(error);
  }
}