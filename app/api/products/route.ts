import { NextRequest, NextResponse } from 'next/server';
import { success, serverError } from '@/lib/utils/api-response';
import { db } from '@/lib/db';
import { products, productVariants, productImages } from '@/lib/db/schema';
import { eq, and, isNull, asc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || '';
    const q = searchParams.get('q') || '';
    const sort = searchParams.get('sort') || 'default';
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));

    const allProducts = await db.query.products.findMany({
      where: and(eq(products.isActive, true), isNull(products.deletedAt)),
      with: {
        variants: { where: eq(productVariants.isActive, true), orderBy: [asc(productVariants.sortOrder)] },
        images: { orderBy: [asc(productImages.sortOrder)], limit: 1 },
        category: true,
      },
    });

    // Filter by category
    let filtered = allProducts;
    if (category) {
      filtered = filtered.filter((p) => p.category?.slug === category);
    }

    // Filter by search query
    if (q) {
      const searchLower = q.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.nameId.toLowerCase().includes(searchLower) ||
          p.nameEn.toLowerCase().includes(searchLower) ||
          p.category?.nameId.toLowerCase().includes(searchLower)
      );
    }

    // Sort: OOS items go to end
    const inStock: typeof filtered = [];
    const outOfStock: typeof filtered = [];
    filtered.forEach((p) => {
      const hasStock = p.variants.some((v) => v.stock > 0);
      if (hasStock) inStock.push(p);
      else outOfStock.push(p);
    });

    const sortFn = (a: typeof filtered[0], b: typeof filtered[0]) => {
      switch (sort) {
        case 'price_asc':
          return (a.variants[0]?.price ?? 0) - (b.variants[0]?.price ?? 0);
        case 'price_desc':
          return (b.variants[0]?.price ?? 0) - (a.variants[0]?.price ?? 0);
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default:
          return (a.variants[0]?.sortOrder ?? 999) - (b.variants[0]?.sortOrder ?? 999);
      }
    };

    inStock.sort(sortFn);
    outOfStock.sort(sortFn);
    const sorted = [...inStock, ...outOfStock];

    // Paginate
    const total = sorted.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginated = sorted.slice(offset, offset + limit);

    // Shape response
    const result = paginated.map((p) => ({
      id: p.id,
      nameId: p.nameId,
      nameEn: p.nameEn,
      slug: p.slug,
      isHalal: p.isHalal,
      shortDescriptionId: p.shortDescriptionId,
      category: p.category,
      variants: p.variants.map((v) => ({
        id: v.id,
        nameId: v.nameId,
        nameEn: v.nameEn,
        price: v.price,
        b2bPrice: v.b2bPrice,
        stock: v.stock,
        weightGram: v.weightGram,
      })),
      imageUrl: p.images[0]?.cloudinaryUrl ?? null,
    }));

    return success({ products: result, total, page, totalPages });
  } catch (error) {
    console.error('[api/products]', error);
    return serverError(error);
  }
}