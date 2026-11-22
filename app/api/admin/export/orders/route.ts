import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { forbidden, serverError } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';
import { formatWIB } from '@/lib/utils/format-date';
import { logAdminActivity } from '@/lib/services/audit.service';
import { withRateLimit } from '@/lib/utils/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = withRateLimit(async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session?.user) {
      return forbidden('Anda harus login');
    }

    // S8: full order export contains customer PII (names, phones, addresses)
    // — owner/superadmin only, not warehouse.
    const role = session.user.role;
    if (!role || !['superadmin', 'owner'].includes(role)) {
      return forbidden('Anda tidak memiliki akses');
    }

    await logAdminActivity({
      userId: session.user.id,
      action: 'export.orders',
      targetType: 'orders',
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: req.headers.get('user-agent'),
    });

    const allOrders = await db.query.orders.findMany({
      orderBy: [desc(orders.createdAt)],
      with: { user: true },
    });

    const rows = [
      'Order Number,Customer Name,Email,Phone,Status,Delivery Method,Subtotal,Shipping,Discount,Points Discount,Total,Tracking Number,Paid At,Shipped At,Delivered At,Created At',
    ];

    for (const o of allOrders) {
      rows.push([
        o.orderNumber,
        `"${(o.recipientName || '').replace(/"/g, '""')}"`,
        o.recipientEmail,
        o.recipientPhone,
        o.status,
        o.deliveryMethod,
        o.subtotal.toString(),
        o.shippingCost.toString(),
        (o.discountAmount || 0).toString(),
        (o.pointsDiscount || 0).toString(),
        o.totalAmount.toString(),
        o.trackingNumber || '',
        o.paidAt ? formatWIB(o.paidAt) : '',
        o.shippedAt ? formatWIB(o.shippedAt) : '',
        o.deliveredAt ? formatWIB(o.deliveredAt) : '',
        formatWIB(o.createdAt),
      ].join(','));
    }

    const csv = rows.join('\n');
    const date = new Date().toISOString().split('T')[0];

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="orders-${date}.csv"`,
      },
    });
  } catch (error) {
    return serverError(error);
  }
}, 'admin');