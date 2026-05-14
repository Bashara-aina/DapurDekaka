import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders, orderStatusHistory } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { success, unauthorized, forbidden, notFound, conflict, serverError } from '@/lib/utils/api-response';
import { z } from 'zod';

const TrackingSchema = z.object({
  trackingNumber: z.string().min(8).max(30).regex(/^[A-Za-z0-9-]+$/, {
    message: 'Nomor resi hanya boleh huruf, angka, dan tanda hubung',
  }),
  courierCode: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized();
    }

    const role = session.user.role;
    if (!['superadmin', 'owner', 'warehouse'].includes(role ?? '')) {
      return forbidden();
    }

    const { id: orderId } = await params;
    const body = await req.json();
    const parsed = TrackingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Data tidak valid', details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const { trackingNumber, courierCode } = parsed.data;

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      return notFound('Pesanan tidak ditemukan');
    }

    if (order.status !== 'packed') {
      return conflict('Pesanan harus dalam status "dikemas" untuk menambahkan nomor resi');
    }

    const trackingUrl = courierCode 
      ? `https://track.aik.id/${courierCode.toLowerCase()}/${trackingNumber}`
      : null;

    await db.transaction(async (tx) => {
      await tx
        .update(orders)
        .set({ 
          trackingNumber,
          trackingUrl,
          courierCode: courierCode ?? order.courierCode,
          status: 'shipped',
          shippedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId));

      await tx.insert(orderStatusHistory).values({
        orderId,
        fromStatus: 'packed',
        toStatus: 'shipped',
        changedByUserId: session.user.id,
        changedByType: 'admin',
        note: `Nomor resi ditambahkan: ${trackingNumber}`,
      });
    });

    return success({
      orderId,
      orderNumber: order.orderNumber,
      trackingNumber,
      trackingUrl,
      message: `Resi ${trackingNumber} berhasil disimpan untuk pesanan ${order.orderNumber}`,
    });
  } catch (error) {
    console.error('[admin/field/orders/tracking]', error);
    return serverError(error);
  }
}
