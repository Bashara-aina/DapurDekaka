import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { orders } from '@/lib/db/schema';
import { success, serverError, notFound, unauthorized, validationError } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';
import { withRateLimit } from '@/lib/utils/rate-limit';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const emailVerificationSchema = z.object({
  email: z.string().email('Format email tidak valid'),
});

type OrderRow = NonNullable<Awaited<ReturnType<typeof db.query.orders.findFirst>>> & {
  items: Array<{
    productNameId: string;
    variantNameId: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
};

/**
 * S4: explicit customer-safe DTO. Never expose midtransSnapToken, internal
 * ids, or shipping margin fields (`biteshipActualCost`, `shippingMarkupAmount`,
 * `needsAttentionReason`) to the order owner/email verifier.
 */
function toCustomerOrderDto(order: OrderRow) {
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    deliveryMethod: order.deliveryMethod,
    pickupCode: order.deliveryMethod === 'pickup' ? order.pickupCode : null,
    recipientName: order.recipientName,
    recipientEmail: order.recipientEmail,
    recipientPhone: order.recipientPhone,
    addressLine: order.addressLine,
    district: order.district,
    city: order.city,
    province: order.province,
    postalCode: order.postalCode,
    courierName: order.courierName,
    courierService: order.courierService,
    trackingNumber: order.trackingNumber,
    trackingUrl: order.trackingUrl,
    subtotal: order.subtotal,
    discountAmount: order.discountAmount,
    pointsDiscount: order.pointsDiscount,
    shippingCost: order.shippingCost,
    insuranceFee: order.insuranceFee,
    totalAmount: order.totalAmount,
    pointsUsed: order.pointsUsed,
    pointsEarned: order.pointsEarned,
    paymentMethod: order.paymentMethod,
    // Verified owners may see their own payment instructions (VA/QRIS) so
    // /checkout/pending can render them — but never the Snap token or costs.
    midtransVaNumber: order.midtransVaNumber,
    midtransPaymentType: order.midtransPaymentType,
    paymentExpiresAt: order.paymentExpiresAt,
    paidAt: order.paidAt,
    shippedAt: order.shippedAt,
    deliveredAt: order.deliveredAt,
    cancelledAt: order.cancelledAt,
    createdAt: order.createdAt,
    items: order.items.map((item) => ({
      productNameId: item.productNameId,
      variantNameId: item.variantNameId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
    })),
  };
}

export const GET = withRateLimit(async (
  req: NextRequest,
  context?: { params: Promise<{ orderNumber: string }> }
) => {
  try {
    if (!context) return notFound('Order tidak ditemukan');
    const { orderNumber } = await context.params;
    const searchParams = req.nextUrl.searchParams;
    const guestEmail = searchParams.get('email');

    const session = await auth();

    const order = await db.query.orders.findFirst({
      where: eq(orders.orderNumber, orderNumber),
      with: { items: true },
    });

    if (!order) {
      return notFound('Order tidak ditemukan');
    }

    // If user is logged in, verify they own this order
    if (session?.user?.id) {
      if (order.userId === session.user.id || session.user.role === 'superadmin' || session.user.role === 'owner') {
        return success({ order: toCustomerOrderDto(order as OrderRow), verified: true });
      }
    }

    // For guests, require email verification
    if (guestEmail) {
      if (order.recipientEmail?.toLowerCase() === guestEmail.toLowerCase()) {
        return success({ order: toCustomerOrderDto(order as OrderRow), verified: true });
      }
      return unauthorized('Email tidak cocok dengan pesanan');
    }

    // No session and no email — return NON-sensitive status only. Payment
    // details (amount, VA number, payment type) require ownership/email
    // verification (P0#7): an order number alone must not leak them.
    return success({
      order: {
        orderNumber: order.orderNumber,
        status: order.status,
        deliveryMethod: order.deliveryMethod,
        paymentExpiresAt: order.paymentExpiresAt,
        createdAt: order.createdAt,
      },
      verified: false,
      requiresEmailVerification: true,
    });

  } catch (error) {
    return serverError(error);
  }
}, 'shipping');

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params;
    const body = await req.json();
    const parsed = emailVerificationSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const { email } = parsed.data;

    const order = await db.query.orders.findFirst({
      where: eq(orders.orderNumber, orderNumber),
      with: { items: true },
    });

    if (!order) {
      return notFound('Order tidak ditemukan');
    }

    if (order.recipientEmail?.toLowerCase() !== email.toLowerCase()) {
      return unauthorized('Email tidak cocok dengan pesanan');
    }

    return success({
      order: {
        orderNumber: order.orderNumber,
        status: order.status,
        deliveryMethod: order.deliveryMethod,
        pickupCode: order.deliveryMethod === 'pickup' ? order.pickupCode : null,
        recipientName: order.recipientName,
        recipientPhone: order.recipientPhone,
        addressLine: order.addressLine,
        district: order.district,
        city: order.city,
        province: order.province,
        courierName: order.courierName,
        trackingNumber: order.trackingNumber,
        trackingUrl: order.trackingUrl,
        subtotal: order.subtotal,
        discountAmount: order.discountAmount,
        pointsDiscount: order.pointsDiscount,
        shippingCost: order.shippingCost,
        totalAmount: order.totalAmount,
        pointsEarned: order.pointsEarned,
        paidAt: order.paidAt,
        shippedAt: order.shippedAt,
        deliveredAt: order.deliveredAt,
        items: order.items,
      },
      verified: true,
    });

  } catch (error) {
    return serverError(error);
  }
}