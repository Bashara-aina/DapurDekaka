import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { orders } from '@/lib/db/schema';
import { success, serverError, notFound, unauthorized, validationError } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';
import { z } from 'zod';

const emailVerificationSchema = z.object({
  email: z.string().email('Format email tidak valid'),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params;
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
        return success({ order, verified: true });
      }
    }

    // For guests, require email verification
    if (guestEmail) {
      if (order.recipientEmail?.toLowerCase() === guestEmail.toLowerCase()) {
        return success({ order, verified: true });
      }
      return unauthorized('Email tidak cocok dengan pesanan');
    }

    // No session and no email - return minimal info for status tracking only
    return success({
      order: {
        orderNumber: order.orderNumber,
        status: order.status,
        deliveryMethod: order.deliveryMethod,
        createdAt: order.createdAt,
      },
      verified: false,
      requiresEmailVerification: true,
    });

  } catch (error) {
    console.error('[orders/[orderNumber]/route]', error);
    return serverError(error);
  }
}

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
    console.error('[orders/[orderNumber]/route POST]', error);
    return serverError(error);
  }
}