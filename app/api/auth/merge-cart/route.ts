import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { savedCarts } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { success, unauthorized, serverError } from '@/lib/utils/api-response';
import { withRateLimit } from '@/lib/utils/rate-limit';
import { logger } from '@/lib/utils/logger';
import { z } from 'zod';

const CartItemSchema = z.object({
  variantId: z.string().uuid('Invalid variant ID'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1').max(99, 'Quantity cannot exceed 99'),
});

const MergeCartSchema = z.object({
  items: z.array(CartItemSchema),
});

export const POST = withRateLimit(
  async (req: NextRequest) => {
    try {
      const session = await auth();

      if (!session?.user?.id) {
        return unauthorized('Silakan masuk terlebih dahulu');
      }

      const body = await req.json();
      const parsed = MergeCartSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: 'Invalid cart items', code: 'VALIDATION_ERROR' },
          { status: 422 }
        );
      }

      const { items } = parsed.data;

      const userId = session.user.id;
      let mergedCount = 0;

      await db.transaction(async (tx) => {
        for (const item of items) {
          const cappedQty = Math.min(item.quantity, 99);

          // Check if this variant already exists in user's saved cart
          const existing = await tx
            .select()
            .from(savedCarts)
            .where(
              and(
                eq(savedCarts.userId, userId),
                eq(savedCarts.variantId, item.variantId)
              )
            )
            .limit(1);

          if (existing.length > 0) {
            // Merge: add quantities, cap at 99
            const existingItem = existing[0];
            if (!existingItem) continue;
            const newQty = Math.min(existingItem.quantity + cappedQty, 99);
            await tx
              .update(savedCarts)
              .set({ quantity: newQty })
              .where(
                and(
                  eq(savedCarts.userId, userId),
                  eq(savedCarts.variantId, item.variantId)
                )
              );
          } else {
            // Insert new item
            await tx.insert(savedCarts).values({
              userId,
              variantId: item.variantId,
              quantity: cappedQty,
            });
          }
          mergedCount++;
        }
      });

      return success({ merged: mergedCount });

    } catch (error) {
      logger.error('[auth/merge-cart]', { error });
      return serverError(error);
    }
  },
  'money'
);