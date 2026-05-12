import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { carouselSlides } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET(req: NextRequest) {
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

    const allSlides = await db.query.carouselSlides.findMany({
      orderBy: [desc(carouselSlides.sortOrder)],
    });

    return NextResponse.json({ success: true, data: allSlides });
  } catch (error) {
    console.error('[Admin Carousel GET]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

import { z } from 'zod';

export async function POST(req: NextRequest) {
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
      type: z.enum(['product_hero', 'promo', 'brand_story']),
      titleId: z.string().min(1),
      titleEn: z.string().min(1),
      subtitleId: z.string().optional(),
      subtitleEn: z.string().optional(),
      imageUrl: z.string().min(1),
      imagePublicId: z.string().min(1),
      ctaLabelId: z.string().optional(),
      ctaLabelEn: z.string().optional(),
      ctaUrl: z.string().optional(),
      badgeText: z.string().optional(),
      sortOrder: z.number().int().nonnegative().default(0),
      isActive: z.boolean().default(true),
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

    const data = parsed.data;
    const [created] = await db.insert(carouselSlides).values({
      type: data.type,
      titleId: data.titleId,
      titleEn: data.titleEn,
      subtitleId: data.subtitleId ?? null,
      subtitleEn: data.subtitleEn ?? null,
      imageUrl: data.imageUrl,
      imagePublicId: data.imagePublicId,
      ctaLabelId: data.ctaLabelId ?? null,
      ctaLabelEn: data.ctaLabelEn ?? null,
      ctaUrl: data.ctaUrl ?? null,
      badgeText: data.badgeText ?? null,
      sortOrder: data.sortOrder,
      isActive: data.isActive,
      startsAt: data.startsAt ? new Date(data.startsAt) : null,
      endsAt: data.endsAt ? new Date(data.endsAt) : null,
    }).returning();

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    console.error('[Admin Carousel POST]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}