import { NextRequest } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { disputes, orders, refunds } from '@/lib/db/schema';
import { success, unauthorized, forbidden, validationError, conflict, serverError } from '@/lib/utils/api-response';
import { eq, desc } from 'drizzle-orm';
import { logger } from '@/lib/utils/logger';
import { withRateLimit } from '@/lib/utils/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const createSchema = z.object({
  orderNumber: z.string().min(1),
  category: z.enum(['spoilage', 'ongkir', 'lost', 'wrong_item', 'other']),
  customerMessage: z.string().min(1),
  refundAmount: z.number().int().min(0).default(0),
});

/**
 * POST /api/admin/disputes — log a new dispute from the customer playbook.
 * If `refundAmount > 0`, also create a refund ledger row with status=pending.
 */
export const POST = withRateLimit(async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized('Silakan login');
    if (!['superadmin', 'owner'].includes(session.user.role)) return forbidden();

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const order = await db.query.orders.findFirst({
      where: eq(orders.orderNumber, parsed.data.orderNumber),
    });
    if (!order) return conflict(`Order ${parsed.data.orderNumber} tidak ditemukan`);

    const result = await db.transaction(async (tx) => {
      let refundId: string | null = null;
      if (parsed.data.refundAmount > 0) {
        const [r] = await tx
          .insert(refunds)
          .values({
            orderId: order.id,
            amount: parsed.data.refundAmount,
            reason: parsed.data.category === 'spoilage' ? 'cold_chain_failure' : 'customer_request',
            method: 'manual',
            status: 'pending',
            initiatedBy: session.user.id,
            notes: `Logged with dispute from admin ${session.user.id}`,
          })
          .returning({ id: refunds.id });
        refundId = r?.id ?? null;
      }

      const [d] = await tx
        .insert(disputes)
        .values({
          orderId: order.id,
          category: parsed.data.category,
          customerMessage: parsed.data.customerMessage,
          status: 'open',
          refundId,
          handledBy: session.user.id,
        })
        .returning({ id: disputes.id });
      return { disputeId: d?.id, refundId };
    });

    return success({ ...result, orderId: order.id });
  } catch (error) {
    logger.error('[admin/disputes POST]', { error: error instanceof Error ? error.message : String(error) });
    return serverError(error);
  }
}, 'admin');
