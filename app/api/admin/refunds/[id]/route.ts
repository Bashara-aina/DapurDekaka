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
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const patchSchema = z.object({
  status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
  notes: z.string().max(2000).nullable().optional(),
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized('Silakan login');
    if (!['superadmin', 'owner'].includes(session.user.role ?? '')) {
      return forbidden('Anda tidak memiliki akses');
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const updates: {
      status?: 'pending' | 'processing' | 'completed' | 'failed';
      notes?: string | null;
      processedAt?: Date | null;
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

    if (Object.keys(updates).length === 0) return success({ ok: true, noop: true });

    const [updated] = await db
      .update(refunds)
      .set(updates)
      .where(eq(refunds.id, id))
      .returning();

    if (!updated) return notFound('Refund tidak ditemukan');
    return success(updated);
  } catch (error) {
    logger.error('[admin/refunds/[id] PATCH]', { error: error instanceof Error ? error.message : String(error) });
    return serverError(error);
  }
}

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
    const [deleted] = await db.delete(refunds).where(eq(refunds.id, id)).returning();
    if (!deleted) return notFound('Refund tidak ditemukan');
    return success({ deleted: true });
  } catch (error) {
    logger.error('[admin/refunds/[id] DELETE]', { error: error instanceof Error ? error.message : String(error) });
    return serverError(error);
  }
}