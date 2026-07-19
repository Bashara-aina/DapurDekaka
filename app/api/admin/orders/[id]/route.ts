import { NextRequest } from 'next/server';
import { eq, desc, and, inArray, sql } from 'drizzle-orm';
import { success, notFound, unauthorized, forbidden, serverError } from '@/lib/utils/api-response';
import { logger } from '@/lib/utils/logger';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders, orderItems, orderStatusHistory } from '@/lib/db/schema';
import { withRateLimit } from '@/lib/utils/rate-limit';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = withRateLimit(
  async (
    req: NextRequest,
    context: { params: Promise<{ id: string }> } | undefined
  ): Promise<Response> => {
    if (!context) {
      return unauthorized('Silakan login terlebih dahulu');
    }
    const { params } = context;
    const { id } = await params;

    try {
      const session = await auth();
      if (!session?.user) {
        return unauthorized('Silakan login terlebih dahulu');
      }

      const role = session.user.role;
      if (!role || !['superadmin', 'owner', 'warehouse'].includes(role)) {
        return forbidden('Anda tidak memiliki akses');
      }

      const order = await db.query.orders.findFirst({
        where: eq(orders.id, id),
        with: {
          items: true,
          user: {
            columns: { id: true, name: true, email: true, phone: true },
          },
          statusHistory: {
            orderBy: [desc(orderStatusHistory.createdAt)],
          },
        },
      });

      if (!order) {
        return notFound('Order tidak ditemukan');
      }

      // C-03: Warehouse can only view orders in packed/shipped status, and only sees limited fields
      if (role === 'warehouse') {
        if (!['packed', 'shipped'].includes(order.status)) {
          return forbidden('Warehouse hanya dapat melihat pesanan yang sudah dikemas atau dikirim');
        }
        // Strip PII: hide full phone, email, address for warehouse role
        const { recipientPhone: _phone, recipientEmail: _email, addressLine: _addr, ...rest } = order;
        const sanitizedOrder = {
          ...rest,
          recipientPhone: null,
          recipientEmail: null,
          addressLine: null,
          district: null,
          city: null,
          cityId: null,
          province: null,
          provinceId: null,
          postalCode: null,
        };
        return success(sanitizedOrder);
      }

      return success(order);
    } catch (error) {
      logger.error('[Admin Orders GET id]', { error });
      return serverError(error);
    }
  },
  { windowMs: 60000, maxRequests: 30 }
);