import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { refunds, orders } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  success,
  unauthorized,
  forbidden,
  notFound,
  validationError,
  serverError,
} from '@/lib/utils/api-response';
import { logger } from '@/lib/utils/logger';
import { applyRefundCompletionTx } from '@/lib/finance/complete-refund';
import { flagNeedsAttention } from '@/lib/ops/needs-attention';
import { logAdminActivity } from '@/lib/services/audit.service';
import { getClientIp, getUserAgent } from '@/lib/utils/request-meta';
import { withRateLimit } from '@/lib/utils/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const patchSchema = z.object({
  status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
  notes: z.string().max(2000).nullable().optional(),
  midtransRefundId: z.string().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized('Silakan login');
    if (!['superadmin', 'owner'].includes(session.user.role ?? '')) {
      return forbidden('Anda tidak memiliki akses');
    }

    const { id } = await params;
    const row = await db
      .select({
        id: refunds.id,
        orderId: refunds.orderId,
        orderNumber: orders.orderNumber,
        amount: refunds.amount,
        reason: refunds.reason,
        method: refunds.method,
        status: refunds.status,
        notes: refunds.notes,
        initiatedBy: refunds.initiatedBy,
        processedAt: refunds.processedAt,
        createdAt: refunds.createdAt,
        updatedAt: refunds.updatedAt,
      })
      .from(refunds)
      .leftJoin(orders, eq(refunds.orderId, orders.id))
      .where(eq(refunds.id, id))
      .limit(1);

    if (row.length === 0) return notFound('Refund tidak ditemukan');
    return success(row[0]);
  } catch (error) {
    logger.error('[admin/refunds/[id] GET]', { error: error instanceof Error ? error.message : String(error) });
    return serverError(error);
  }
}

export const PATCH = withRateLimit(async (
  req: NextRequest,
  context?: { params: Promise<{ id: string }> }
) => {
  try {
    const params = context?.params ?? Promise.resolve({ id: '' });
    const session = await auth();
    if (!session?.user) return unauthorized('Silakan login');
    if (!['superadmin', 'owner'].includes(session.user.role ?? '')) {
      return forbidden('Anda tidak memiliki akses');
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const existing = await db.query.refunds.findFirst({ where: eq(refunds.id, id) });
    if (!existing) return notFound('Refund tidak ditemukan');

    const order = await db.query.orders.findFirst({ where: eq(orders.id, existing.orderId) });
    if (!order) return notFound('Pesanan tidak ditemukan');

    const nextStatus = parsed.data.status ?? existing.status;

    await db.transaction(async (tx) => {
      const updates: {
        status?: 'pending' | 'processing' | 'completed' | 'failed';
        notes?: string | null;
        processedAt?: Date | null;
        midtransRefundId?: string;
      } = {};

      if (parsed.data.status !== undefined) {
        updates.status = parsed.data.status;
        if (parsed.data.status === 'completed' || parsed.data.status === 'failed') {
          updates.processedAt = new Date();
        } else {
          updates.processedAt = null;
        }
      }
      if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;
      if (parsed.data.midtransRefundId) updates.midtransRefundId = parsed.data.midtransRefundId;

      if (Object.keys(updates).length > 0) {
        await tx.update(refunds).set(updates).where(eq(refunds.id, id));
      }

      if (nextStatus === 'completed' && existing.status !== 'completed') {
        const isFullRefund = existing.amount >= order.totalAmount;
        await applyRefundCompletionTx(tx, {
          orderId: order.id,
          orderNumber: order.orderNumber,
          userId: order.userId,
          refundAmount: existing.amount,
          totalAmount: order.totalAmount,
          isFullRefund,
          currentStatus: order.status,
        });
      }

      if (nextStatus === 'failed') {
        await tx
          .update(orders)
          .set({
            needsAttention: true,
            needsAttentionReason: 'refund_failed',
            updatedAt: new Date(),
          })
          .where(eq(orders.id, order.id));
      }
    });

    if (nextStatus === 'failed') {
      await flagNeedsAttention(order.id, 'refund_failed', `Refund gagal: ${order.orderNumber}`);
    }

    void logAdminActivity({
      userId: session.user.id,
      action: `refund.${nextStatus}`,
      targetType: 'refund',
      targetId: id,
      afterState: { orderId: order.id, orderNumber: order.orderNumber, status: nextStatus },
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    });

    const [updated] = await db
      .select()
      .from(refunds)
      .where(eq(refunds.id, id))
      .limit(1);

    return success(updated);
  } catch (error) {
    logger.error('[admin/refunds/[id] PATCH]', { error: error instanceof Error ? error.message : String(error) });
    return serverError(error);
  }
}, 'admin');

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized('Silakan login');
    if (!['superadmin', 'owner'].includes(session.user.role ?? '')) {
      return forbidden('Anda tidak memiliki akses');
    }

    const { id } = await params;
    const existing = await db.query.refunds.findFirst({ where: eq(refunds.id, id) });
    if (!existing) return notFound('Refund tidak ditemukan');
    if (existing.status === 'completed') {
      return forbidden('Refund yang sudah selesai tidak dapat dihapus');
    }

    const [deleted] = await db.delete(refunds).where(eq(refunds.id, id)).returning();
    if (!deleted) return notFound('Refund tidak ditemukan');
    return success({ deleted: true });
  } catch (error) {
    logger.error('[admin/refunds/[id] DELETE]', { error: error instanceof Error ? error.message : String(error) });
    return serverError(error);
  }
}
