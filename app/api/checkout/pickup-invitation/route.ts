import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { z, ZodError } from 'zod';
import { db } from '@/lib/db';
import { orders, orderItems } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { withRateLimit } from '@/lib/utils/rate-limit';
import { success, serverError, validationError, notFound, forbidden } from '@/lib/utils/api-response';
import { sendEmail } from '@/lib/resend/send-email';
import { PickupInvitationEmail } from '@/lib/resend/templates/PickupInvitation';
import { formatWIB } from '@/lib/utils/format-date';
import { logger } from '@/lib/utils/logger';

const pickupInvitationSchema = z.object({
  orderId: z.string().uuid().optional(),
  orderNumber: z.string().optional(),
});

/**
 * POST /api/checkout/pickup-invitation
 * Regenerate and send a pickup invitation email for an existing order.
 * Requires authentication or valid order credentials.
 */
export const POST = withRateLimit(
  async (req: NextRequest) => {
    try {
      const session = await auth();
      const body = await req.json();
      const parsed = pickupInvitationSchema.safeParse(body);

      if (!parsed.success) {
        return validationError(parsed.error);
      }

      const { orderId, orderNumber } = parsed.data;

      // Build query conditions
      const orderWhere = orderId
        ? eq(orders.id, orderId)
        : orderNumber
          ? eq(orders.orderNumber, orderNumber)
          : null;

      if (!orderWhere) {
        return NextResponse.json(
          {
            success: false,
            error: 'orderId or orderNumber is required',
            code: 'VALIDATION_ERROR',
          },
          { status: 422 }
        );
      }

      // Fetch order with items
      const order = await db.query.orders.findFirst({
        where: orderWhere,
        with: { items: true },
      });

      if (!order) {
        return notFound('Pesanan tidak ditemukan');
      }

      // Security: only owner, superadmin, owner, or the customer who placed the order can request
      const isAdmin = session?.user?.role === 'superadmin' || session?.user?.role === 'owner';
      const isCustomer = order.userId && session?.user?.id === order.userId;

      if (!isAdmin && !isCustomer) {
        return forbidden('Anda tidak memiliki akses untuk pesanan ini');
      }

      // Must be a pickup order
      if (order.deliveryMethod !== 'pickup') {
        return NextResponse.json(
          {
            success: false,
            error: 'Pesanan ini bukan pesanan pengambilan',
            code: 'VALIDATION_ERROR',
          },
          { status: 422 }
        );
      }

      // Pickup code is the order number
      const pickupCode = order.orderNumber;

      // Regenerate pickup code if order is paid and has no pickupCode
      let finalPickupCode = order.pickupCode ?? pickupCode;

      // Send email asynchronously
      sendEmail({
        to: order.recipientEmail,
        subject: `Pesanan ${order.orderNumber} siap diambil!`,
        react: PickupInvitationEmail({
          orderNumber: order.orderNumber,
          customerName: order.recipientName,
          items: order.items.map((item) => ({
            name: item.productNameId,
            variant: item.variantNameId,
            quantity: item.quantity,
          })),
          totalAmount: order.totalAmount,
          pickupCode: finalPickupCode,
          paidAt: order.paidAt ? formatWIB(order.paidAt) : formatWIB(new Date()),
          pickupAddress: process.env.NEXT_PUBLIC_STORE_ADDRESS ?? 'Jl. Sinom V no. 7, Turangga, Bandung',
          openingHours: 'Senin-Sabtu: 08.00 - 17.00 WIB',
        }),
      }).catch((emailError) => {
        logger.error('[PickupInvitation] Failed to send email', {
          orderNumber: order.orderNumber,
          error: emailError instanceof Error ? emailError.message : String(emailError),
        });
      });

      return success({
        message: 'Email undangan pengambilan telah dikirim',
        pickupCode: finalPickupCode,
        sentTo: order.recipientEmail,
      });
    } catch (error) {
      logger.error('[pickup-invitation]', { error: error instanceof Error ? error.message : String(error) });
      return serverError(error instanceof Error ? error : new Error(String(error)));
    }
  },
  { windowMs: 60000, maxRequests: 10 }
);