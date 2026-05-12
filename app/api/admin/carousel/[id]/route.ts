import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { carouselSlides } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    if (!['superadmin', 'owner'].includes(session.user.role as string)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const slide = await db.query.carouselSlides.findFirst({
      where: eq(carouselSlides.id, params.id),
    });

    if (!slide) {
      return NextResponse.json(
        { success: false, error: 'Slide not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: slide });
  } catch (error) {
    console.error('[Admin Carousel GET:id]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    if (!['superadmin', 'owner'].includes(session.user.role as string)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 }
      );
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
      return NextResponse.json(
        { success: false, error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const existing = await db.query.carouselSlides.findFirst({
      where: eq(carouselSlides.id, params.id),
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Slide not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
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

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('[Admin Carousel PUT]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    if (!['superadmin', 'owner'].includes(session.user.role as string)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const existing = await db.query.carouselSlides.findFirst({
      where: eq(carouselSlides.id, params.id),
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Slide not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    await db.delete(carouselSlides).where(eq(carouselSlides.id, params.id));

    return NextResponse.json({ success: true, data: { id: params.id } });
  } catch (error) {
    console.error('[Admin Carousel DELETE]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}