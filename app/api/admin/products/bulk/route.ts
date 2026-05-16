import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { products } from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';
import { success, unauthorized, forbidden, serverError } from '@/lib/utils/api-response';

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized('Silakan login terlebih dahulu');
    const role = session.user.role;
    if (!role || !['superadmin', 'owner'].includes(role)) return forbidden('Anda tidak memiliki akses');

    const body = await req.json();
    const { ids, action } = body as { ids: string[]; action: string };

    if (!Array.isArray(ids) || ids.length === 0) {
      return success({ updated: 0 });
    }

    if (action === 'disable') {
      await db.update(products).set({ isActive: false }).where(inArray(products.id, ids));
    } else if (action === 'enable') {
      await db.update(products).set({ isActive: true }).where(inArray(products.id, ids));
    }

    return success({ updated: ids.length });
  } catch (error) {
    console.error('[Admin Products Bulk PATCH]', error);
    return serverError(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized('Silakan login terlebih dahulu');
    const role = session.user.role;
    if (role !== 'superadmin') return forbidden('Hanya superadmin yang dapat menghapus');

    const body = await req.json();
    const { ids } = body as { ids: string[] };

    if (!Array.isArray(ids) || ids.length === 0) {
      return success({ deleted: 0 });
    }

    const now = new Date();
    await db.update(products).set({ deletedAt: now }).where(inArray(products.id, ids));

    return success({ deleted: ids.length });
  } catch (error) {
    console.error('[Admin Products Bulk DELETE]', error);
    return serverError(error);
  }
}