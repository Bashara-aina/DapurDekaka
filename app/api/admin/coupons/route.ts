import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { coupons } from '@/lib/db/schema';
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
    if (session.user.role !== 'superadmin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const allCoupons = await db.query.coupons.findMany({
      orderBy: [desc(coupons.createdAt)],
    });

    return NextResponse.json({ success: true, data: allCoupons });
  } catch (error) {
    console.error('[Admin Coupons GET]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

const CreateCouponSchema = z.object({
  code: z.string().min(1).max(50),
  type: z.enum(['percentage', 'fixed', 'free_shipping', 'buy_x_get_y']),
  nameId: z.string().min(1).max(255),
  nameEn: z.string().min(1).max(255),
  descriptionId: z.string().optional(),
  descriptionEn: z.string().optional(),
  discountValue: z.number().int().nonnegative().optional(),
  minOrderAmount: z.number().int().nonnegative().default(0),
  maxDiscountAmount: z.number().int().nonnegative().optional().nullable(),
  freeShipping: z.boolean().default(false),
  buyQuantity: z.number().int().nonnegative().optional(),
  getQuantity: z.number().int().nonnegative().optional(),
  maxUses: z.number().int().nonnegative().optional().nullable(),
  maxUsesPerUser: z.number().int().nonnegative().optional().nullable(),
  isPublic: z.boolean().default(false),
  startsAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    if (session.user.role !== 'superadmin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = CreateCouponSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const code = parsed.data.code.toUpperCase().trim();
    const existing = await db.query.coupons.findFirst({
      where: eq(coupons.code, code),
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Kode kupon sudah digunakan', code: 'DUPLICATE_CODE' },
        { status: 409 }
      );
    }

    const newCoupon = {
      code,
      type: parsed.data.type,
      nameId: parsed.data.nameId,
      nameEn: parsed.data.nameEn,
      descriptionId: parsed.data.descriptionId ?? null,
      descriptionEn: parsed.data.descriptionEn ?? null,
      discountValue: parsed.data.discountValue ?? null,
      minOrderAmount: parsed.data.minOrderAmount,
      maxDiscountAmount: parsed.data.maxDiscountAmount ?? null,
      freeShipping: parsed.data.freeShipping,
      buyQuantity: parsed.data.buyQuantity ?? null,
      getQuantity: parsed.data.getQuantity ?? null,
      maxUses: parsed.data.maxUses ?? null,
      usedCount: 0,
      maxUsesPerUser: parsed.data.maxUsesPerUser ?? null,
      isActive: true,
      isPublic: parsed.data.isPublic,
      startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      createdBy: session.user.id as string,
    };

    const [created] = await db.insert(coupons).values(newCoupon).returning();
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    console.error('[Admin Coupons POST]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}