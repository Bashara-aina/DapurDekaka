import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { refunds, orders } from '@/lib/db/schema';
import { desc, eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  success,
  created,
  unauthorized,
  forbidden,
  notFound,
  validationError,
  serverError,
} from '@/lib/utils/api-response';
import { logger } from '@/lib/utils/logger';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const createSchema = z.object({
  orderNumber: z.string().min(1).max(30),
  amount: z.number().int().min(1),
  reason: z.enum(['customer_request', 'cold_chain_failure', 'stock_out', 'fraud', 'other']),
  method: z.enum(['midtrans', 'manual']).default('midtrans'),
  notes: z.string().max(2000).optional(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized('Silakan login');
    if (!['superadmin', 'owner'].includes(session.user.role ?? '')) {
      return forbidden('Anda tidak memiliki akses');
    }

    const sp = req.nextUrl.searchParams;
    const status = sp.get('status') ?? '';
    const orderNumber = sp.get('orderNumber') ?? '';
    const limit = Math.min(200, Math.max(1, parseInt(sp.get('limit') ?? '200', 10)));

    const conditions: ReturnType<typeof eq>[] = [];
    if (status) {
      const allowed = ['pending', 'processing', 'completed', 'failed'] as const;
      if ((allowed as readonly string[]).includes(status)) {
        conditions.push(eq(refunds.status, status as (typeof allowed)[number]));
      }
    }

    const baseQuery = db
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
      .orderBy(desc(refunds.createdAt))
      .limit(limit);

    const finalQuery =
      conditions.length > 0 ? baseQuery.where(conditions.length === 1 ? conditions[0] : and(...conditions)) : baseQuery;

    let rows = await finalQuery;

    if (orderNumber) {
      const q = orderNumber.toLowerCase();
      rows = rows.filter((r) => (r.orderNumber ?? '').toLowerCase().includes(q));
    }

    return success(rows);
  } catch (error) {
    logger.error('[admin/refunds GET]', { error: error instanceof Error ? error.message : String(error) });
    return serverError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized('Silakan login');
    if (!['superadmin', 'owner'].includes(session.user.role ?? '')) {
      return forbidden('Anda tidak memiliki akses');
    }

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const order = await db.query.orders.findFirst({
      where: eq(orders.orderNumber, parsed.data.orderNumber),
    });
    if (!order) return notFound(`Order ${parsed.data.orderNumber} tidak ditemukan`);

    const status = parsed.data.status ?? 'pending';
    const processedAt = status === 'completed' || status === 'failed' ? new Date() : null;

    const [row] = await db
      .insert(refunds)
      .values({
        orderId: order.id,
        amount: parsed.data.amount,
        reason: parsed.data.reason,
        method: parsed.data.method,
        status,
        initiatedBy: session.user.id,
        notes: parsed.data.notes ?? null,
        processedAt,
      })
      .returning();

    return created(row);
  } catch (error) {
    logger.error('[admin/refunds POST]', { error: error instanceof Error ? error.message : String(error) });
    return serverError(error);
  }
}