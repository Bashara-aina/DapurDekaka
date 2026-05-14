import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orders, users } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { success, forbidden, serverError } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';
import { formatWIB } from '@/lib/utils/format-date';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return forbidden('Anda harus login');
    }

    const role = session.user.role;
    if (!role || !['superadmin', 'owner', 'warehouse'].includes(role)) {
      return forbidden('Anda tidak memiliki akses');
    }

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
    console.error('[admin/export/orders]', error);
    return serverError(error);
  }
}