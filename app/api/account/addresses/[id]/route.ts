import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { addresses } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { success, unauthorized, notFound, serverError } from '@/lib/utils/api-response';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface DeleteAddressParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(req: NextRequest, { params }: DeleteAddressParams) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
      return unauthorized('Silakan masuk terlebih dahulu');
    }

    const existing = await db.query.addresses.findFirst({
      where: and(
        eq(addresses.id, id),
        eq(addresses.userId, session.user.id)
      ),
    });

    if (!existing) {
      return notFound('Alamat tidak ditemukan');
    }

    await db.delete(addresses)
      .where(and(
        eq(addresses.id, id),
        eq(addresses.userId, session.user.id)
      ));

    return success({ deleted: true });

  } catch (error) {
    logger.error('[account/addresses DELETE]', { error: error instanceof Error ? error.message : String(error) });
    return serverError(error);
  }
}

export async function PUT(req: NextRequest, { params }: DeleteAddressParams) {
  try {
    const session = await auth();
    const { id } = await params;
    const body = await req.json();

    if (!session?.user?.id) {
      return unauthorized('Silakan masuk terlebih dahulu');
    }

    // Explicit ownership check before any modification (BOLA fix)
    const existing = await db.query.addresses.findFirst({
      where: and(
        eq(addresses.id, id),
        eq(addresses.userId, session.user.id)
      ),
    });
    if (!existing) {
      return notFound('Alamat tidak ditemukan');
    }

    if (body.isDefault) {
      await db.update(addresses)
        .set({ isDefault: false })
        .where(eq(addresses.userId, session.user.id));
    }

    const updated = await db.update(addresses)
      .set({ isDefault: body.isDefault })
      .where(and(
        eq(addresses.id, id),
        eq(addresses.userId, session.user.id)
      ))
      .returning();

    if (!updated.length) {
      return notFound('Alamat tidak ditemukan');
    }

    return success(updated[0]);

  } catch (error) {
    logger.error('[account/addresses/[id] PUT]', { error: error instanceof Error ? error.message : String(error) });
    return serverError(error);
  }
}