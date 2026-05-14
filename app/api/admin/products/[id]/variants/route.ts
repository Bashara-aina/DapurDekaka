import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { productVariants, products } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    const role = (session.user as { role?: string }).role;
    if (!role || !['superadmin', 'owner'].includes(role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const product = await db.query.products.findFirst({
      where: eq(products.id, params.id),
    });
    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Produk tidak ditemukan', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    const body = await req.json();
    const parsed = CreateVariantSchema.safeParse(body);
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

    const skuExists = await db.query.productVariants.findFirst({
      where: eq(productVariants.sku, parsed.data.sku),
    });
    if (skuExists) {
      return NextResponse.json(
        { success: false, error: 'SKU sudah digunakan varian lain', code: 'DUPLICATE_SKU' },
        { status: 409 }
      );
    }

    const [created] = await db
      .insert(productVariants)
      .values({
        productId: params.id,
        nameId: parsed.data.nameId,
        nameEn: parsed.data.nameEn,
        sku: parsed.data.sku,
        price: parsed.data.price,
        b2bPrice: parsed.data.b2bPrice ?? null,
        stock: parsed.data.stock ?? 0,
        weightGram: parsed.data.weightGram,
        sortOrder: parsed.data.sortOrder ?? 0,
        isActive: parsed.data.isActive ?? true,
      })
      .returning();

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    console.error('[Admin Product Variants POST]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

const CreateVariantSchema = z.object({
  nameId: z.string().min(1).max(100, 'Nama Indonesia maksimal 100 karakter'),
  nameEn: z.string().min(1).max(100, 'Nama English maksimal 100 karakter'),
  sku: z.string().min(1).max(100, 'SKU maksimal 100 karakter'),
  price: z.number().int().nonnegative('Harga harus bilangan bulat non-negatif'),
  b2bPrice: z.number().int().nonnegative().optional().nullable(),
  stock: z.number().int().nonnegative().optional().default(0),
  weightGram: z.number().int().nonnegative('Berat harus bilangan bulat non-negatif'),
  sortOrder: z.number().int().nonnegative().optional().default(0),
  isActive: z.boolean().optional().default(true),
});