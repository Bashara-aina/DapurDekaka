import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders, productVariants, b2bQuotes, blogPosts, pointsHistory } from '@/lib/db/schema';
import { eq, gte, sql, and, inArray, desc, lt, isNull, ne } from 'drizzle-orm';
import { success, unauthorized, forbidden, serverError } from '@/lib/utils/api-response';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized();
    }

    const role = session.user.role;
    if (role !== 'superadmin') {
      return forbidden();
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const twoHoursAgo = new Date(today.getTime() - 2 * 60 * 60 * 1000);
    const fourHoursAgo = new Date(today.getTime() - 4 * 60 * 60 * 1000);
    const sixHoursAgo = new Date(today.getTime() - 6 * 60 * 60 * 1000);

    const stuckPaidOrders = await db.query.orders.findMany({
      where: and(
        eq(orders.status, 'paid'),
        lt(orders.paidAt, twoHoursAgo)
      ),
      orderBy: [desc(orders.createdAt)],
      limit: 5,
      with: { items: true },
    });

    const stuckProcessingOrders = await db.query.orders.findMany({
      where: and(
        eq(orders.status, 'processing'),
        lt(orders.updatedAt, fourHoursAgo)
      ),
      orderBy: [desc(orders.createdAt)],
      limit: 3,
    });

    const stuckPackedOrders = await db.query.orders.findMany({
      where: and(
        eq(orders.status, 'packed'),
        isNull(orders.trackingNumber),
        lt(orders.updatedAt, sixHoursAgo)
      ),
      orderBy: [desc(orders.createdAt)],
      limit: 3,
    });

    const lowStockVariants = await db.query.productVariants.findMany({
      where: and(
        sql`${productVariants.stock} < 5`,
        eq(productVariants.isActive, true)
      ),
      orderBy: [asc(productVariants.stock)],
      limit: 5,
      with: { product: true },
    });

    const oldDrafts = await db.query.blogPosts.findMany({
      where: and(
        eq(blogPosts.isPublished, false),
        lt(blogPosts.updatedAt, new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000))
      ),
      orderBy: [desc(blogPosts.updatedAt)],
      limit: 3,
    });

    const queue: { priority: number; type: string; message: string; entityId: string; actionLabel: string; link: string }[] = [];

    stuckPaidOrders.forEach(order => {
      const ageHours = order.paidAt 
        ? Math.round((today.getTime() - new Date(order.paidAt).getTime()) / (1000 * 60 * 60))
        : 0;
      queue.push({
        priority: 1,
        type: 'stuck_order',
        message: `Order ${order.orderNumber} stuck di 'paid' selama ${ageHours}h`,
        entityId: order.id,
        actionLabel: 'Proses',
        link: `/admin/orders/${order.id}`,
      });
    });

    stuckProcessingOrders.forEach(order => {
      queue.push({
        priority: 2,
        type: 'stuck_order',
        message: `Order ${order.orderNumber} stuck di 'processing' lebih dari 4 jam`,
        entityId: order.id,
        actionLabel: 'Kemas',
        link: `/admin/orders/${order.id}`,
      });
    });

    stuckPackedOrders.forEach(order => {
      queue.push({
        priority: 2,
        type: 'missing_tracking',
        message: `Order ${order.orderNumber} sudah dikemas tapi belum ada resi`,
        entityId: order.id,
        actionLabel: 'Isi Resi',
        link: `/admin/orders/${order.id}`,
      });
    });

    lowStockVariants.forEach(variant => {
      queue.push({
        priority: 2,
        type: 'low_stock',
        message: `Stok ${variant.product?.nameId ?? 'Produk'} ${variant.nameId} tersisa ${variant.stock} unit`,
        entityId: variant.id,
        actionLabel: 'Restock',
        link: `/admin/inventory`,
      });
    });

    oldDrafts.forEach(post => {
      queue.push({
        priority: 3,
        type: 'old_draft',
        message: `Blog "${post.titleId}" dalam draft selama lebih dari 3 hari`,
        entityId: post.id,
        actionLabel: 'Publish',
        link: `/admin/blog/${post.id}`,
      });
    });

    queue.sort((a, b) => a.priority - b.priority);

    return success(queue);
  } catch (error) {
    console.error('[admin/dashboard/action-queue]', error);
    return serverError(error);
  }
}

import { asc } from 'drizzle-orm';