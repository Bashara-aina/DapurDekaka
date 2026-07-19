import { NextRequest } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { success, forbidden, notFound, conflict, validationError, serverError } from '@/lib/utils/api-response';
import { dispatchOrder } from '@/lib/shipping/dispatch';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const dispatchSchema = z.object({
  orderId: z.string().uuid(),
});

/**
 * Warehouse-only: book courier via Biteship after order is packed.
 * Delegates the booking to `dispatchOrder()` (shared with the retry cron).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return forbidden('Anda harus login');

    const role = session.user.role;
    if (!role || !['superadmin', 'owner', 'warehouse'].includes(role)) {
      return forbidden('Anda tidak memiliki akses ke fitur ini');
    }

    const body = await req.json();
    const parsed = dispatchSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const outcome = await dispatchOrder(parsed.data.orderId, session.user.id ?? null);

    if (outcome.ok) {
      return success({
        orderId: parsed.data.orderId,
        biteshipOrderId: outcome.biteshipOrderId,
        waybillId: outcome.waybillId,
        trackingUrl: outcome.trackingUrl,
      });
    }

    if (outcome.status === 'not_found') return notFound(outcome.message ?? 'Order tidak ditemukan');
    return conflict(outcome.message ?? 'Dispatch gagal');
  } catch (error) {
    return serverError(error);
  }
}
