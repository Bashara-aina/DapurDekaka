import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
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

      return success({ merged: items.length });

    } catch (error) {
      console.error('[auth/merge-cart]', error);
      return serverError(error);
    }
  },
  { windowMs: 60000, maxRequests: 10 }
);