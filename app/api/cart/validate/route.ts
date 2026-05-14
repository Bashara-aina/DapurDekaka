import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { productVariants, products } from '@/lib/db/schema';
import { inArray, eq } from 'drizzle-orm';
import { ValidateCartSchema } from '@/lib/validations/cart.schema';
import { success, conflict } from '@/lib/utils/api-response';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = ValidateCartSchema.safeParse(body);

    if (!parsed.success) {
      return conflict('Input tidak valid');
    }

    const { items } = parsed.data;

    if (items.length === 0) {
      return success({ items: [] });
    }

    const variantIds = items.map((i) => i.variantId);

    const dbVariants = await db
      .select({
        id: productVariants.id,
        sku: productVariants.sku,
        price: productVariants.price,
        stock: productVariants.stock,
        weightGram: productVariants.weightGram,
        isActive: productVariants.isActive,
        productNameId: products.nameId,
        variantNameId: productVariants.nameId,
      })
      .from(productVariants)
      .leftJoin(products, eq(productVariants.productId, products.id))
      .where(inArray(productVariants.id, variantIds));

    const validationResults = items.map((item) => {
      const variant = dbVariants.find((v) => v.id === item.variantId);

      if (!variant || !variant.isActive) {
        return {
          variantId: item.variantId,
          valid: false,
          reason: 'not_found',
          message: 'Produk tidak ditemukan atau tidak aktif',
        };
      }

      if ((variant.stock ?? 0) < item.quantity) {
        return {
          variantId: item.variantId,
          valid: false,
          reason: 'insufficient_stock',
          availableStock: variant.stock ?? 0,
          message: `Stok tidak mencukupi. Tersisa ${variant.stock ?? 0} pcs.`,
        };
      }

      return {
        variantId: item.variantId,
        valid: true,
        currentPrice: variant.price ?? 0,
        stock: variant.stock ?? 0,
        productName: variant.productNameId,
        variantName: variant.variantNameId,
      };
    });

    const hasInvalid = validationResults.some((r) => !r.valid);

    return success({ items: validationResults }, hasInvalid ? 200 : 200);
  } catch (error) {
    console.error('[cart/validate]', error);
    return conflict('Gagal memvalidasi keranjang');
  }
}