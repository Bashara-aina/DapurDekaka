import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { products, orderItems } from '@/lib/db/schema';
import { inArray, and } from 'drizzle-orm';
import { success, unauthorized, forbidden, serverError, conflict } from '@/lib/utils/api-response';
import { logger } from '@/lib/utils/logger';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_ACTIONS = ['enable', 'disable', 'archive'] as const;
type BulkAction = typeof ALLOWED_ACTIONS[number];

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized('Silakan login terlebih dahulu');
    const role = session.user.role;
    if (!role || !['superadmin', 'owner'].includes(role)) return forbidden('Anda tidak memiliki akses');

    const body = await req.json();
    const { ids, action } = body as { ids: string[]; action: string };

    if (!Array.isArray(ids) || ids.length === 0) {
      return success({ updated: 0 });
    }

    if (!ALLOWED_ACTIONS.includes(action as BulkAction)) {
      return NextResponse.json(
        { success: false, error: `Aksi tidak valid. Aksi yang diperbolehkan: ${ALLOWED_ACTIONS.join(', ')}`, code: 'INVALID_ACTION' },
        { status: 400 }
      );
    }

    if (action === 'disable') {
      await db.update(products).set({ isActive: false }).where(inArray(products.id, ids));
    } else if (action === 'enable') {
      await db.update(products).set({ isActive: true }).where(inArray(products.id, ids));
    } else if (action === 'archive') {
      // H-02: Check for active orders before archiving
      const activeOrderStatuses = ['pending_payment', 'paid', 'processing', 'packed', 'shipped'];
      const activeOrders = await db.query.orderItems.findMany({
        where: and(
          inArray(orderItems.productId, ids),
          orderItems.orderId  // This is a reference, we need to join with orders to check status
        ),
        with: {
          order: {
            columns: { id: true, status: true, orderNumber: true },
          },
        },
      });

      // Check if any referenced order has an active status
      const affectedOrderNumbers = activeOrders
        .filter(item => item.order && activeOrderStatuses.includes(item.order.status))
        .map(item => item.order!.orderNumber);

      if (affectedOrderNumbers.length > 0) {
        return NextResponse.json(
          { success: false, error: `Tidak dapat arsip: produk terkait dengan pesanan aktif (${affectedOrderNumbers.slice(0, 5).join(', ')}${affectedOrderNumbers.length > 5 ? '...' : ''})`, code: 'HAS_ACTIVE_ORDERS' },
          { status: 409 }
        );
      }

      const now = new Date();
      await db.update(products).set({ deletedAt: now }).where(inArray(products.id, ids));
    }

    return success({ updated: ids.length });
  } catch (error) {
    logger.error('[Admin Products Bulk PATCH]', { error: error instanceof Error ? error.message : String(error) });
    return serverError(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized('Silakan login terlebih dahulu');
    const role = session.user.role;
    if (role !== 'superadmin') return forbidden('Hanya superadmin yang dapat menghapus');

    const body = await req.json();
    const { ids } = body as { ids: string[] };

    if (!Array.isArray(ids) || ids.length === 0) {
      return success({ deleted: 0 });
    }

    // Soft delete (archived) — not hard delete
    const now = new Date();
    await db.update(products).set({ deletedAt: now }).where(inArray(products.id, ids));

    return success({ deleted: ids.length });
  } catch (error) {
    logger.error('[Admin Products Bulk DELETE]', { error: error instanceof Error ? error.message : String(error) });
    return serverError(error);
  }
}