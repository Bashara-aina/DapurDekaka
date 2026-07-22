import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { sendWhatsApp } from '@/lib/services/fonnte';
import { logger } from '@/lib/utils/logger';

export type NeedsAttentionReason =
  | 'late_settlement'
  | 'oversell_at_settlement'
  | 'pickup_no_show'
  | 'dispatch_failed'
  | 'gross_mismatch_spam'
  | 'refund_failed'
  | 'reconcile_recovery';

/**
 * Flag an order for solo-operator review and ping WA (P3 backlog #5).
 */
export async function flagNeedsAttention(
  orderId: string,
  reason: NeedsAttentionReason,
  detail: string
): Promise<void> {
  await db
    .update(orders)
    .set({
      needsAttention: true,
      needsAttentionReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));

  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    columns: { orderNumber: true },
  });

  const wa = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  if (!wa) return;

  const msg = `[DDK Ops] ${order?.orderNumber ?? orderId}: ${reason} — ${detail}`;
  try {
    await sendWhatsApp({ phone: wa, message: msg });
  } catch (err) {
    logger.error('[needs-attention] WA failed', {
      orderId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
