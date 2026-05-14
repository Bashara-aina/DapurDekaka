import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { productVariants, products } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; variantId: string } }
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

    const variant = await db.query.productVariants.findFirst({
      where: and(
        eq(productVariants.id, params.variantId),
        eq(productVariants.productId, params.id)
      ),
    });
    if (!variant) {
      return NextResponse.json(
        { success: false, error: 'Varian tidak ditemukan', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    const body = await req.json();
    const parsed = UpdateVariantSchema.safeParse(body);
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

    if (parsed.data.sku && parsed.data.sku !== variant.sku) {
      const skuConflict = await db.query.productVariants.findFirst({
        where: eq(productVariants.sku, parsed.data.sku),
      });
      if (skuConflict) {
        return NextResponse.json(
          { success: false, error: 'SKU sudah digunakan varian lain', code: 'DUPLICATE_SKU' },
          { status: 409 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    const data = parsed.data;

    if (data.nameId !== undefined) updateData.nameId = data.nameId;
    if (data.nameEn !== undefined) updateData.nameEn = data.nameEn;
    if (data.sku !== undefined) updateData.sku = data.sku;
    if (data.price !== undefined) updateData.price = data.price;
    if (data.b2bPrice !== undefined) updateData.b2bPrice = data.b2bPrice;
    if (data.stock !== undefined) updateData.stock = data.stock;
    if (data.weightGram !== undefined) updateData.weightGram = data.weightGram;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    updateData.updatedAt = new Date();

    const [updated] = await db
      .update(productVariants)
      .set(updateData)
      .where(and(
        eq(productVariants.id, params.variantId),
        eq(productVariants.productId, params.id)
      ))
      .returning();

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('[Admin Product Variant PATCH]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; variantId: string } }
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

    const variant = await db.query.productVariants.findFirst({
      where: and(
        eq(productVariants.id, params.variantId),
        eq(productVariants.productId, params.id)
      ),
    });
    if (!variant) {
      return NextResponse.json(
        { success: false, error: 'Varian tidak ditemukan', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    await db
      .update(productVariants)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(
        eq(productVariants.id, params.variantId),
        eq(productVariants.productId, params.id)
      ));

    return NextResponse.json({ success: true, data: { id: params.variantId } });
  } catch (error) {
    console.error('[Admin Product Variant DELETE]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

const UpdateVariantSchema = z.object({
  nameId: z.string().min(1).max(100).optional(),
  nameEn: z.string().min(1).max(100).optional(),
  sku: z.string().min(1).max(100).optional(),
  price: z.number().int().nonnegative().optional(),
  b2bPrice: z.number().int().nonnegative().optional().nullable(),
  stock: z.number().int().nonnegative().optional(),
  weightGram: z.number().int().nonnegative().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
});