import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { addresses } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { success, created, unauthorized, badRequest, serverError, notFound, validationError } from '@/lib/utils/api-response';
import { z } from 'zod';

const addressSchema = z.object({
  label: z.string().max(100).optional(),
  recipientName: z.string().min(2, 'Nama penerima minimal 2 karakter'),
  recipientPhone: z.string().min(5, 'Nomor telepon tidak valid'),
  addressLine: z.string().min(10, 'Alamat terlalu pendek'),
  district: z.string().min(1, 'Kecamatan harus diisi'),
  city: z.string().min(1, 'Kota harus diisi'),
  cityId: z.string().min(1, 'ID kota harus diisi'),
  province: z.string().min(1, 'Provinsi harus diisi'),
  provinceId: z.string().min(1, 'ID provinsi harus diisi'),
  postalCode: z.string().min(5, 'Kode pos tidak valid'),
  isDefault: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return unauthorized('Silakan masuk terlebih dahulu');
    }

    const userAddresses = await db.query.addresses.findMany({
      where: eq(addresses.userId, session.user.id),
      orderBy: [desc(addresses.isDefault), desc(addresses.createdAt)],
    });

    return success(userAddresses);
  } catch (error) {
    console.error('[account/addresses GET]', error);
    return serverError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return unauthorized('Silakan masuk terlebih dahulu');
    }

    const body = await req.json();
    const parsed = addressSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const data = parsed.data;

    if (data.isDefault) {
      await db.update(addresses)
        .set({ isDefault: false })
        .where(eq(addresses.userId, session.user.id));
    }

    const [newAddress] = await db.insert(addresses).values({
      userId: session.user.id,
      label: data.label || null,
      recipientName: data.recipientName,
      recipientPhone: data.recipientPhone,
      addressLine: data.addressLine,
      district: data.district,
      city: data.city,
      cityId: data.cityId,
      province: data.province,
      provinceId: data.provinceId,
      postalCode: data.postalCode,
      isDefault: data.isDefault || false,
    }).returning();

    return created(newAddress);

  } catch (error) {
    console.error('[account/addresses POST]', error);
    return serverError(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return unauthorized('Silakan masuk terlebih dahulu');
    }

    const body = await req.json();
    const { id, ...updateData } = body;

    if (!id) {
      return badRequest('ID harus diisi');
    }

    const parsed = addressSchema.omit({ isDefault: true }).safeParse(updateData);
    if (!parsed.success) {
      return validationError(parsed.error);
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

    const updated = await db.update(addresses)
      .set(parsed.data)
      .where(and(
        eq(addresses.id, id),
        eq(addresses.userId, session.user.id)
      ))
      .returning();

    return success(updated[0]);

  } catch (error) {
    console.error('[account/addresses PUT]', error);
    return serverError(error);
  }
}