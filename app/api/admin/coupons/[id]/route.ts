import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { coupons } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { success, notFound, serverError, unauthorized, forbidden, validationError, conflict } from '@/lib/utils/api-response';
import { logger } from '@/lib/utils/logger';
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
    if (session.user.role !== 'superadmin') {
      return forbidden('Anda tidak memiliki akses');
    }

    const coupon = await db.query.coupons.findFirst({
      where: and(eq(coupons.id, params.id), isNull(coupons.deletedAt)),
    });

    if (!coupon) {
      return notFound('Kupon tidak ditemukan');
    }

    return success(coupon);
  } catch (error) {
    logger.error('[Admin Coupon GET]', { error });
    return serverError(error);
  }
}

const UpdateCouponSchema = z.object({
  code: z.string().min(1).max(50).optional(),
  type: z.enum(['percentage', 'fixed', 'free_shipping', 'buy_x_get_y']).optional(),
  nameId: z.string().min(1).max(255).optional(),
  nameEn: z.string().min(1).max(255).optional(),
  descriptionId: z.string().optional(),
  descriptionEn: z.string().optional(),
  discountValue: z.number().int().nonnegative().optional().nullable(),
  minOrderAmount: z.number().int().nonnegative().optional(),
  maxDiscountAmount: z.number().int().nonnegative().optional().nullable(),
  freeShipping: z.boolean().optional(),
  buyQuantity: z.number().int().nonnegative().optional().nullable(),
  getQuantity: z.number().int().nonnegative().optional().nullable(),
  maxUses: z.number().int().nonnegative().optional().nullable(),
  maxUsesPerUser: z.number().int().nonnegative().optional().nullable(),
  isActive: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  startsAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized('Silakan login terlebih dahulu');
    }
    if (session.user.role !== 'superadmin') {
      return forbidden('Anda tidak memiliki akses');
    }

    const body = await req.json();
    const parsed = UpdateCouponSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const existing = await db.query.coupons.findFirst({
      where: and(eq(coupons.id, params.id), isNull(coupons.deletedAt)),
    });
    if (!existing) {
      return notFound('Kupon tidak ditemukan');
    }

    if (parsed.data.code && parsed.data.code.toUpperCase() !== existing.code) {
      const duplicate = await db.query.coupons.findFirst({
        where: eq(coupons.code, parsed.data.code.toUpperCase()),
      });
      if (duplicate) {
        return conflict('Kode kupon sudah digunakan');
      }
    }

    const updateData: Record<string, unknown> = {};
    const data = parsed.data;
    
    if (data.code !== undefined) updateData.code = data.code.toUpperCase();
    if (data.type !== undefined) updateData.type = data.type;
    if (data.nameId !== undefined) updateData.nameId = data.nameId;
    if (data.nameEn !== undefined) updateData.nameEn = data.nameEn;
    if (data.descriptionId !== undefined) updateData.descriptionId = data.descriptionId;
    if (data.descriptionEn !== undefined) updateData.descriptionEn = data.descriptionEn;
    if (data.discountValue !== undefined) updateData.discountValue = data.discountValue;
    if (data.minOrderAmount !== undefined) updateData.minOrderAmount = data.minOrderAmount;
    if (data.maxDiscountAmount !== undefined) updateData.maxDiscountAmount = data.maxDiscountAmount;
    if (data.freeShipping !== undefined) updateData.freeShipping = data.freeShipping;
    if (data.buyQuantity !== undefined) updateData.buyQuantity = data.buyQuantity;
    if (data.getQuantity !== undefined) updateData.getQuantity = data.getQuantity;
    if (data.maxUses !== undefined) updateData.maxUses = data.maxUses;
    if (data.maxUsesPerUser !== undefined) updateData.maxUsesPerUser = data.maxUsesPerUser;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.isPublic !== undefined) updateData.isPublic = data.isPublic;
    if (data.startsAt !== undefined) updateData.startsAt = data.startsAt ? new Date(data.startsAt) : null;
    if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;

    updateData.updatedAt = new Date();

    const [updated] = await db
      .update(coupons)
      .set(updateData)
      .where(eq(coupons.id, params.id))
      .returning();

    return success(updated);
  } catch (error) {
    logger.error('[Admin Coupon PUT]', { error });
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
    if (session.user.role !== 'superadmin') {
      return forbidden('Anda tidak memiliki akses');
    }

    const existing = await db.query.coupons.findFirst({
      where: and(eq(coupons.id, params.id), isNull(coupons.deletedAt)),
    });
    if (!existing) {
      return notFound('Kupon tidak ditemukan');
    }

    await db
      .update(coupons)
      .set({ deletedAt: new Date() })
      .where(eq(coupons.id, params.id));

    return success({ id: params.id });
  } catch (error) {
    logger.error('[Admin Coupon DELETE]', { error });
    return serverError(error);
  }
}