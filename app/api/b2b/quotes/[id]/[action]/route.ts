import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { b2bQuotes, b2bProfiles, b2bQuoteItems, orders, orderItems, productVariants, inventoryLogs, pointsHistory, users, orderStatusHistory, coupons, couponUsages, orderDailyCounters } from '@/lib/db/schema';
import { eq, and, gte, sql, desc, inArray } from 'drizzle-orm';
import { success, unauthorized, forbidden, notFound, serverError } from '@/lib/utils/api-response';
import { sendEmail } from '@/lib/resend/send-email';
import { B2BQuoteApprovedEmail } from '@/lib/resend/templates/B2BQuoteApproved';
import { B2BQuoteRejectedEmail } from '@/lib/resend/templates/B2BQuoteRejected';
import { formatWIB } from '@/lib/utils/format-date';
import { generateOrderNumber } from '@/lib/utils/generate-order-number';
import { OrderConfirmationEmail } from '@/lib/resend/templates/OrderConfirmation';
import { logger } from '@/lib/utils/logger';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * H-03: B2B Quote → Order Conversion
 *
 * When B2B customer accepts a quote:
 * 1. Create formal order in `orders` table with `isB2b: true`
 * 2. Deduct stock atomically (GREATEST pattern, same as checkout webhook)
 * 3. Award points (B2B 2x multiplier)
 * 4. Send order confirmation email
 * 5. Update quote status to `accepted`
 * 6. If Net-30, mark order as `paid` immediately (skip Midtrans)
 */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; action: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized('Login diperlukan');

    if (session.user.role !== 'b2b' && session.user.role !== 'superadmin' && session.user.role !== 'owner') {
      return forbidden('Akses ditolak');
    }

    const { id, action } = await params;

    if (action !== 'accept' && action !== 'reject') {
      return notFound('Action tidak valid');
    }

    const quote = await db.query.b2bQuotes.findFirst({
      where: eq(b2bQuotes.id, id),
      with: { items: true, b2bProfile: true },
    });

    if (!quote) {
      return notFound('Quote tidak ditemukan');
    }

    // BUG-01 FIX: B2B user can only accept/reject their own quotes
    if (session.user.role === 'b2b' && quote.b2bProfile.userId !== session.user.id) {
      return forbidden('Anda tidak memiliki akses ke quote ini');
    }

    if (action === 'accept') {
      await db.transaction(async (tx) => {
        // ── Step 1: Generate order number via atomic counter ────────────────
        const today = new Date().toISOString().slice(0, 10);

        const counterResult = await tx
          .insert(orderDailyCounters)
          .values({ date: today, lastSequence: 1 })
          .onConflictDoUpdate({
            target: orderDailyCounters.date,
            set: { lastSequence: sql`${orderDailyCounters.lastSequence} + 1`, updatedAt: new Date() },
          })
          .returning({ newSequence: orderDailyCounters.lastSequence });

        const seq = counterResult[0]?.newSequence ?? 1;
        const orderNumber = generateOrderNumber(seq);

        // ── Step 2: Determine Net-30 status from B2B profile ────────────────
        const isNet30Order = quote.b2bProfile.isNet30Approved;
        const net30PaymentDueAt = isNet30Order
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          : null;

        // ── Step 3: Create formal order (isB2b: true) ───────────────────────
        const orderStatus = isNet30Order ? 'paid' : 'pending_payment';
        const [createdOrder] = await tx
          .insert(orders)
          .values({
            orderNumber,
            userId: quote.b2bProfile.userId,
            status: orderStatus,
            isB2b: true,
            deliveryMethod: 'delivery',
            recipientName: quote.b2bProfile.picName,
            recipientEmail: quote.b2bProfile.picEmail,
            recipientPhone: quote.b2bProfile.picPhone,
            addressLine: quote.b2bProfile.businessAddress,
            subtotal: quote.subtotal,
            discountAmount: quote.discountAmount,
            totalAmount: quote.totalAmount,
            pointsEarned: Math.floor(quote.subtotal / 1000) * 2, // B2B 2x multiplier
            paymentMethod: isNet30Order ? 'net30' : 'midtrans',
            paymentDueAt: net30PaymentDueAt,
            paidAt: isNet30Order ? new Date() : null,
            paymentExpiresAt: isNet30Order ? null : new Date(Date.now() + 15 * 60 * 1000),
          })
          .returning();

        if (!createdOrder) throw new Error('Gagal membuat pesanan dari quote');

        // ── Step 4: Create order items from quote items ────────────────────
        // Look up productId from variants for each quote item
        const variantIds = quote.items.map((item) => item.variantId);
        const variantsLookup = await tx
          .select({ id: productVariants.id, productId: productVariants.productId })
          .from(productVariants)
          .where(inArray(productVariants.id, variantIds));

        const variantToProductId = new Map(variantsLookup.map((v) => [v.id, v.productId]));

        const orderItemsData = quote.items.map((item) => {
          const productId = variantToProductId.get(item.variantId);
          if (!productId) {
            throw new Error(`Produk tidak ditemukan untuk variant ${item.variantId}`);
          }
          return {
            orderId: createdOrder.id,
            variantId: item.variantId,
            productId, // resolved from productVariants lookup
            productNameId: item.productNameId,
            productNameEn: item.productNameId, // no separate EN name in quote items; use ID as fallback
            variantNameId: item.variantNameId,
            variantNameEn: item.variantNameId,
            sku: item.sku,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            subtotal: item.subtotal,
            weightGram: 0,
          };
        });

        await tx.insert(orderItems).values(orderItemsData);

        // ── Step 5: Deduct stock atomically (GREATEST pattern) ──────────────
        for (const item of quote.items) {
          const [updated] = await tx
            .update(productVariants)
            .set({ stock: sql`GREATEST(stock - ${item.quantity}, 0)` })
            .where(and(
              eq(productVariants.id, item.variantId),
              gte(productVariants.stock, item.quantity)
            ))
            .returning({ newStock: productVariants.stock });

          if (!updated) {
            throw new Error(`Stok tidak mencukupi untuk variant ${item.variantId}`);
          }

          await tx.insert(inventoryLogs).values({
            variantId: item.variantId,
            changeType: 'sale',
            quantityBefore: updated.newStock + item.quantity,
            quantityAfter: updated.newStock,
            quantityDelta: -item.quantity,
            orderId: createdOrder.id,
            note: `Penjualan via B2B quote ${quote.quoteNumber}`,
          });
        }

        // ── Step 6: Award loyalty points (B2B 2x multiplier) ───────────────
        if (quote.b2bProfile.userId) {
          const pointsEarned = Math.floor(quote.subtotal / 1000) * 2;
          const [updatedUser] = await tx
            .update(users)
            .set({ pointsBalance: sql`points_balance + ${pointsEarned}` })
            .where(eq(users.id, quote.b2bProfile.userId))
            .returning({ pointsBalance: users.pointsBalance });

          const newBalance = updatedUser?.pointsBalance ?? pointsEarned;

          await tx.insert(pointsHistory).values({
            userId: quote.b2bProfile.userId,
            type: 'earn',
            pointsAmount: pointsEarned,
            pointsBalanceAfter: newBalance,
            descriptionId: `Pembelian B2B ${createdOrder.orderNumber} (2x multiplier)`,
            descriptionEn: `B2B purchase ${createdOrder.orderNumber} (2x multiplier)`,
            orderId: createdOrder.id,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          });
        }

        // ── Step 7: Record order status history ────────────────────────────
        await tx.insert(orderStatusHistory).values({
          orderId: createdOrder.id,
          fromStatus: null,
          toStatus: orderStatus,
          changedByType: 'system',
          note: isNet30Order
            ? 'Pesanan B2B Net-30 langsung lunas via quote acceptance'
            : 'Pesanan dibuat dari B2B quote, menunggu pembayaran Midtrans',
        });

        // ── Step 8: Update quote status to accepted ─────────────────────────
        await tx
          .update(b2bQuotes)
          .set({ status: 'accepted', updatedAt: new Date() })
          .where(eq(b2bQuotes.id, id));
      });

      // ── Step 9: Send email notification ───────────────────────────────────
      sendEmail({
        to: quote.b2bProfile.picEmail,
        subject: `Penawaran #${quote.quoteNumber} Telah Disetujui — Pesanan ${quote.quoteNumber}`,
        react: B2BQuoteApprovedEmail({
          quoteNumber: quote.quoteNumber,
          companyName: quote.b2bProfile.companyName,
          items: quote.items.map((item) => ({
            name: item.productNameId,
            variant: item.variantNameId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.subtotal,
          })),
          subtotal: quote.subtotal,
          discountAmount: quote.discountAmount,
          totalAmount: quote.totalAmount,
          validUntil: quote.validUntil ? formatWIB(quote.validUntil) : '',
        }),
      }).catch((err) => {
        console.error('[B2B Quote Approved Email]', err);
      });
    } else {
      // ── Reject: just update status ───────────────────────────────────────
      await db
        .update(b2bQuotes)
        .set({ status: 'rejected', updatedAt: new Date() })
        .where(eq(b2bQuotes.id, id));

      sendEmail({
        to: quote.b2bProfile.picEmail,
        subject: `Penawaran #${quote.quoteNumber} Tidak Dapat Diproses`,
        react: B2BQuoteRejectedEmail({
          quoteNumber: quote.quoteNumber,
          companyName: quote.b2bProfile.companyName,
        }),
      }).catch((err) => {
        console.error('[B2B Quote Rejected Email]', err);
      });
    }

    return success({ id, status: action === 'accept' ? 'accepted' : 'rejected' });
  } catch (error) {
    console.error('[B2B Quote Action POST]', error);
    return serverError(error);
  }
}