import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { savedCarts } from '@/lib/db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { success, unauthorized, serverError } from '@/lib/utils/api-response';
import { withRateLimit } from '@/lib/utils/rate-limit';
import type { CartItem } from '@/store/cart.store';

interface MergeCartRequest {
  items: CartItem[];
}

export const POST = withRateLimit(
  async (req: NextRequest) => {
    try {
      const session = await auth();

      if (!session?.user?.id) {
        return unauthorized('Silakan masuk terlebih dahulu');
      }

      const body = await req.json() as MergeCartRequest;
      const { items } = body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return success({ merged: 0 });
      }

      await db.transaction(async (tx) => {
        // Delete user's existing saved cart
        await tx.delete(savedCarts).where(eq(savedCarts.userId, session.user.id));

        // Insert incoming items
        if (items.length > 0) {
          await tx.insert(savedCarts).values(
            items.map((item) => ({
              userId: session.user.id,
              variantId: item.variantId,
              quantity: item.quantity,
            }))
          );
        }
      });

      return success({ merged: items.length });

    } catch (error) {
      console.error('[auth/merge-cart]', error);
      return serverError(error);
    }
  },
  { windowMs: 60000, maxRequests: 10 }
);