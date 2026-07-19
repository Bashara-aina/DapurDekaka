import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import {
  success,
  validationError,
  notFound,
  serverError,
} from '@/lib/utils/api-response';
import { fetchBiteshipTracking } from '@/lib/shipping/providers/biteship/tracking';
import { getCustomerDispatchLabel } from '@/lib/shipping/status-labels';
import { withRateLimit } from '@/lib/utils/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const querySchema = z.object({
  email: z.string().email(),
});

interface RouteParams {
  params: Promise<{ orderNumber: string }>;
}

/**
 * Public order tracking with email verification.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { orderNumber } = await params;
    const email = req.nextUrl.searchParams.get('email');
    const parsed = querySchema.safeParse({ email });
    if (!parsed.success) return validationError(parsed.error);

    const order = await db.query.orders.findFirst({
      where: eq(orders.orderNumber, orderNumber),
      with: { statusHistory: { orderBy: (h, { asc }) => [asc(h.createdAt)] } },
    });

    if (!order) return notFound('Pesanan tidak ditemukan');
    if (order.recipientEmail.toLowerCase() !== parsed.data.email.toLowerCase()) {
      return notFound('Pesanan tidak ditemukan');
    }

    let liveStatus: Awaited<ReturnType<typeof fetchBiteshipTracking>> = null;
    if (
      order.biteshipOrderId &&
      !['delivered', 'cancelled', 'refunded'].includes(order.status)
    ) {
      liveStatus = await fetchBiteshipTracking(order.biteshipOrderId);
    }

    return success({
      orderNumber: order.orderNumber,
      status: order.status,
      shippingTier: order.shippingTier,
      deliveryMethod: order.deliveryMethod,
      courierName: order.courierName,
      courierCode: order.courierCode,
      trackingNumber: order.trackingNumber,
      liveTrackUrl: order.liveTrackUrl ?? order.trackingUrl,
      driverName: order.driverName,
      driverPhone: order.driverPhone,
      driverPlate: order.driverPlate,
      insuranceType: order.insuranceType,
      estimatedDays: order.estimatedDays,
      dispatchStatus: order.dispatchStatus,
      customerStatusLabel: getCustomerDispatchLabel(
        order.status,
        order.dispatchStatus,
        order.deliveryMethod
      ),
      timeline: order.statusHistory.map((h) => ({
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        note: h.note,
        createdAt: h.createdAt,
      })),
      biteshipLiveStatus: liveStatus?.status ?? null,
    });
  } catch (error) {
    return serverError(error);
  }
}
