import { NextRequest, NextResponse } from 'next/server';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { success, notFound, unauthorized, forbidden, serverError, validationError } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users, orders, addresses, pointsHistory } from '@/lib/db/schema';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized('Silakan login terlebih dahulu');
    }

    const role = (session.user as { role?: string }).role;
    if (!role || !['superadmin', 'owner'].includes(role)) {
      return forbidden('Anda tidak memiliki akses');
    }

    const { id } = await params;

    const user = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!user) {
      return notFound('Pelanggan tidak ditemukan');
    }

    const [userOrders, userAddresses, userPointsHistory] = await Promise.all([
      db.query.orders.findMany({
        where: eq(orders.userId, id),
        orderBy: [desc(orders.createdAt)],
        limit: 20,
        columns: {
          id: true,
          orderNumber: true,
          status: true,
          totalAmount: true,
          createdAt: true,
          paidAt: true,
        },
      }),
      db.query.addresses.findMany({
        where: eq(addresses.userId, id),
        orderBy: [desc(addresses.isDefault)],
      }),
      db.query.pointsHistory.findMany({
        where: eq(pointsHistory.userId, id),
        orderBy: [desc(pointsHistory.createdAt)],
        limit: 20,
      }),
    ]);

    return success({
      ...user,
      orders: userOrders,
      addresses: userAddresses,
      pointsHistory: userPointsHistory,
    });
  } catch (error) {
    console.error('[Admin/Customers/GET id]', error);
    return serverError(error);
  }
}

const UpdateCustomerSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized('Silakan login terlebih dahulu');
    }

    const role = (session.user as { role?: string }).role;
    if (!role || !['superadmin', 'owner'].includes(role)) {
      return forbidden('Anda tidak memiliki akses');
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = UpdateCustomerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 422 }
      );
    }

    const { name, phone, isActive } = parsed.data;

    const existing = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!existing) {
      return notFound('Pelanggan tidak ditemukan');
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (isActive !== undefined) updateData.isActive = isActive;

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();

    return success(updated);
  } catch (error) {
    console.error('[Admin/Customers/PATCH id]', error);
    return serverError(error);
  }
}