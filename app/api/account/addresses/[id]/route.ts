import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { addresses } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { success, unauthorized, notFound, serverError } from '@/lib/utils/api-response';

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
    console.error('[account/addresses DELETE]', error);
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
    console.error('[account/addresses/[id] PUT]', error);
    return serverError(error);
  }
}