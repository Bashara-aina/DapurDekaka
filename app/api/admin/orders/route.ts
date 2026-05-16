import { NextRequest } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders, orderItems, orderDailyCounters, orderStatusHistory, productVariants, inventoryLogs } from '@/lib/db/schema';
import { eq, desc, and, isNull, sql, inArray, gte, lt, or, ilike } from 'drizzle-orm';
import { success, unauthorized, forbidden, serverError, validationError } from '@/lib/utils/api-response';
import { generateOrderNumber } from '@/lib/utils/generate-order-number';

const ORDER_STATUSES = [
  'pending_payment',
  'paid',
  'processing',
  'packed',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
] as const;

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized('Silakan login terlebih dahulu');
    }

    const role = session.user.role;
    if (!role || !['superadmin', 'owner', 'warehouse'].includes(role)) {
      return forbidden('Anda tidak memiliki akses');
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const offset = (page - 1) * limit;
    const status = searchParams.get('status');
    const search = searchParams.get('search') ?? '';
    const isB2b = searchParams.get('isB2b');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const conditions: any[] = [];

    if (status && ORDER_STATUSES.includes(status as typeof ORDER_STATUSES[number])) {
      conditions.push(eq(orders.status, status as typeof ORDER_STATUSES[number]));
    }

    if (isB2b === 'true') {
      conditions.push(eq(orders.isB2b, true));
    } else if (isB2b === 'false') {
      conditions.push(eq(orders.isB2b, false));
    }

    if (dateFrom) {
      conditions.push(gte(orders.createdAt, new Date(dateFrom)));
    }
    if (dateTo) {
      conditions.push(lt(orders.createdAt, new Date(dateTo)));
    }

    if (search) {
      conditions.push(
        or(
          ilike(orders.orderNumber, `%${search}%`),
          ilike(orders.recipientName, `%${search}%`),
          ilike(orders.recipientPhone, `%${search}%`),
        )
      );
    }

    const whereClause = conditions.length > 0
      ? (conditions.length > 1 ? and(...conditions) : conditions[0])
      : undefined;

    const [orderList, totalResult] = await Promise.all([
      db.query.orders.findMany({
        where: whereClause,
        with: {
          items: true,
          user: {
            columns: { id: true, name: true, email: true },
          },
        },
        orderBy: [desc(orders.createdAt)],
        limit,
        offset,
      }),
      db
        .select({ count: sql<number>`count(*)` })
        .from(orders)
        .where(whereClause)
        .execute()
        .then(r => r[0]?.count ?? 0),
    ]);

    return success({
      orders: orderList,
      pagination: {
        page,
        limit,
        total: totalResult,
        totalPages: Math.ceil(totalResult / limit),
      },
    });
  } catch (error) {
    console.error('[Admin Orders GET]', error);
    return serverError(error);
  }
}

const orderQuerySchema = z.object({
  recipientName: z.string().min(1),
  recipientEmail: z.string().email(),
  recipientPhone: z.string().min(1),
  deliveryMethod: z.enum(['delivery', 'pickup']),
  addressLine: z.string().optional(),
  district: z.string().optional(),
  city: z.string().optional(),
  cityId: z.string().optional(),
  province: z.string().optional(),
  provinceId: z.string().optional(),
  postalCode: z.string().optional(),
  courierCode: z.string().optional(),
  courierService: z.string().optional(),
  courierName: z.string().optional(),
  shippingCost: z.number().int().nonnegative().default(0),
  estimatedDays: z.string().optional(),
  subtotal: z.number().int().nonnegative(),
  discountAmount: z.number().int().nonnegative().default(0),
  pointsDiscount: z.number().int().nonnegative().default(0),
  totalAmount: z.number().int().nonnegative(),
  couponId: z.string().uuid().optional().nullable(),
  couponCode: z.string().optional().nullable(),
  pointsUsed: z.number().int().nonnegative().default(0),
  pointsEarned: z.number().int().nonnegative().default(0),
  customerNote: z.string().optional().nullable(),
  items: z.array(z.object({
    variantId: z.string().uuid(),
    productId: z.string().uuid(),
    productNameId: z.string(),
    productNameEn: z.string(),
    variantNameId: z.string(),
    variantNameEn: z.string(),
    sku: z.string(),
    productImageUrl: z.string().optional().nullable(),
    unitPrice: z.number().int().nonnegative(),
    quantity: z.number().int().positive(),
    subtotal: z.number().int().nonnegative(),
    weightGram: z.number().int().nonnegative(),
  })).min(1, 'Order harus memiliki minimal 1 item'),
  isB2b: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized('Silakan login terlebih dahulu');
    }

    const role = session.user.role;
    if (!role || !['superadmin', 'owner'].includes(role)) {
      return forbidden('Anda tidak memiliki akses untuk membuat pesanan');
    }

    const body = await req.json();
    const parsed = orderQuerySchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const data = parsed.data;

    // Atomic order number generation via counter table, then create order+items in same transaction
    // Using two separate transactions here would cause a race on order number generation
    const today = new Date().toISOString().slice(0, 10);
    const [created] = await db.transaction(async (tx) => {
      const counterRow = await tx
        .insert(orderDailyCounters)
        .values({ date: today, lastSequence: 1 })
        .onConflictDoUpdate({
          target: orderDailyCounters.date,
          set: {
            lastSequence: sql`${orderDailyCounters.lastSequence} + 1`,
            updatedAt: new Date(),
          },
        })
        .returning({ newSequence: orderDailyCounters.lastSequence });

      const seq = counterRow[0]?.newSequence ?? 1;
      const orderNumber = generateOrderNumber(seq);

      const [newOrder] = await tx.insert(orders).values({
        orderNumber,
        recipientName: data.recipientName,
        recipientEmail: data.recipientEmail,
        recipientPhone: data.recipientPhone,
        deliveryMethod: data.deliveryMethod,
        addressLine: data.addressLine ?? null,
        district: data.district ?? null,
        city: data.city ?? null,
        cityId: data.cityId ?? null,
        province: data.province ?? null,
        provinceId: data.provinceId ?? null,
        postalCode: data.postalCode ?? null,
        courierCode: data.courierCode ?? null,
        courierService: data.courierService ?? null,
        courierName: data.courierName ?? null,
        shippingCost: data.shippingCost,
        estimatedDays: data.estimatedDays ?? null,
        subtotal: data.subtotal,
        discountAmount: data.discountAmount,
        pointsDiscount: data.pointsDiscount,
        totalAmount: data.totalAmount,
        couponId: data.couponId ?? null,
        couponCode: data.couponCode ?? null,
        pointsUsed: data.pointsUsed,
        pointsEarned: data.pointsEarned,
        customerNote: data.customerNote ?? null,
        isB2b: data.isB2b,
        status: 'pending_payment',
      }).returning();

      if (!newOrder) {
        throw new Error('Failed to create order');
      }

      // Insert order items
      if (data.items && data.items.length > 0) {
        await tx.insert(orderItems).values(
          data.items.map((item) => ({
            orderId: newOrder.id,
            variantId: item.variantId,
            productId: item.productId,
            productNameId: item.productNameId,
            productNameEn: item.productNameEn,
            variantNameId: item.variantNameId,
            variantNameEn: item.variantNameEn,
            sku: item.sku,
            productImageUrl: item.productImageUrl ?? null,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            subtotal: item.subtotal,
            weightGram: item.weightGram,
          }))
        );

        // Deduct stock atomically (guard against insufficient stock)
        for (const item of data.items) {
          const [updated] = await tx
            .update(productVariants)
            .set({ stock: sql`GREATEST(stock - ${item.quantity}, 0)`, updatedAt: new Date() })
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
            changedByUserId: session.user.id,
            changeType: 'sale',
            quantityBefore: updated.newStock + item.quantity,
            quantityAfter: updated.newStock,
            quantityDelta: -item.quantity,
            orderId: newOrder.id,
            note: `Admin order ${orderNumber}`,
          });
        }
      }

      // Write initial status history
      await tx.insert(orderStatusHistory).values({
        orderId: newOrder.id,
        fromStatus: null,
        toStatus: 'pending_payment',
        changedByUserId: session.user.id,
        changedByType: 'admin',
        note: 'Pesanan dibuat secara manual oleh admin',
      });

      return [newOrder];
    });

    return success(created, 201);
  } catch (error) {
    console.error('[Admin Orders POST]', error);
    return serverError(error);
  }
}