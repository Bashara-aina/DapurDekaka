import { NextRequest } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { refunds, orders } from '@/lib/db/schema';
import {
  success,
  unauthorized,
  forbidden,
  notFound,
  validationError,
  serverError,
} from '@/lib/utils/api-response';
import { logger } from '@/lib/utils/logger';
import { withRateLimit } from '@/lib/utils/rate-limit';
import { applyRefundCompletionTx } from '@/lib/finance/complete-refund';
import { flagNeedsAttention } from '@/lib/ops/needs-attention';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const patchSchema = z.object({
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  midtransRefundId: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * PATCH /api/admin/orders/[id]/refund — mark a pending refund obligation
 * as processed (L2 Rule 7). Owner-only.
 */
export const PATCH = withRateLimit(async (req: NextRequest, ctx: { params: Promise<{ id: string }> } | undefined) => {
  try {
    if (!ctx) return unauthorized('Bad request');
    const { id: orderId } = await ctx.params;

    const session = await auth();
    if (!session?.user) return unauthorized('Silakan login');
    if (!['superadmin', 'owner'].includes(session.user.role)) return forbidden();

    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
    if (!order) return notFound('Pesanan tidak ditemukan');

    const pendingRefund = await db.query.refunds.findFirst({
      where: eq(refunds.orderId, orderId),
    });
    if (!pendingRefund) return notFound('Tidak ada catatan refund untuk pesanan ini');

    await db.transaction(async (tx) => {
      const updates: {
        status: 'pending' | 'processing' | 'completed' | 'failed';
        processedAt: Date;
        midtransRefundId?: string;
        notes?: string;
      } = {
        status: parsed.data.status,
        processedAt: new Date(),
      };
      if (parsed.data.midtransRefundId) updates.midtransRefundId = parsed.data.midtransRefundId;
      if (parsed.data.notes) updates.notes = parsed.data.notes;

      await tx.update(refunds).set(updates).where(eq(refunds.id, pendingRefund.id));

      if (parsed.data.status === 'completed') {
        const isFullRefund = pendingRefund.amount >= order.totalAmount;
        await applyRefundCompletionTx(tx, {
          orderId: order.id,
          orderNumber: order.orderNumber,
          userId: order.userId,
          refundAmount: pendingRefund.amount,
          totalAmount: order.totalAmount,
          isFullRefund,
          currentStatus: order.status,
        });
      }

      if (parsed.data.status === 'failed') {
        await tx
          .update(orders)
          .set({ needsAttention: true, needsAttentionReason: 'refund_failed', updatedAt: new Date() })
          .where(eq(orders.id, order.id));
      }
    });

    if (parsed.data.status === 'failed') {
      await flagNeedsAttention(order.id, 'refund_failed', `Refund gagal: ${order.orderNumber}`);
    }

    return success({ refundId: pendingRefund.id, status: parsed.data.status });
  } catch (error) {
    logger.error('[admin/orders/refund PATCH]', {
      error: error instanceof Error ? error.message : String(error),
    });
    return serverError(error);
  }
}, { windowMs: 60_000, maxRequests: 30 });
