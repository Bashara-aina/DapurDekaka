import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { products, productVariants } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { success, serverError, validationError } from '@/lib/utils/api-response';
import { logger } from '@/lib/utils/logger';
import { withRateLimit } from '@/lib/utils/rate-limit';
import { rankProducts, type ProductSearchDoc } from '@/lib/search/product-search';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 300;

const querySchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

interface RankableProduct {
  doc: ProductSearchDoc;
  row: {
    id: string;
    nameId: string;
    nameEn: string;
    slug: string;
    shortDescriptionId: string | null;
    isHalal: boolean;
    isActive: boolean;
    createdAt: Date;
    category: { id: string; nameId: string; slug: string } | null;
    variants: Array<{
      id: string;
      nameId: string;
      nameEn: string;
      sku: string;
      price: number;
      stock: number;
      weightGram: number;
      isActive: boolean;
      sortOrder: number;
    }>;
    images: Array<{ cloudinaryUrl: string; sortOrder: number }>;
  };
}

/**
 * GET /api/search/products?q=dimsun&limit=20 — typo-tolerant catalog search.
 *
 * Server-side LIKE only matches exact substrings; this endpoint ranks the
 * whole active catalog with fuse.js (weighted keys, edit-distance tolerant)
 * so "dimsun" still finds Dimsum. Public tier rate limit; ISR-cached 5 min.
 */
export const GET = withRateLimit(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = querySchema.safeParse({
      q: searchParams.get('q'),
      limit: searchParams.get('limit') ?? undefined,
    });
    if (!parsed.success) return validationError(parsed.error);

    const { q, limit } = parsed.data;

    const rows = await db.query.products.findMany({
      where: and(eq(products.isActive, true), isNull(products.deletedAt)),
      with: {
        variants: { where: eq(productVariants.isActive, true) },
        images: { orderBy: (images, { asc }) => [asc(images.sortOrder)] },
        category: true,
      },
    });

    const rankable: RankableProduct[] = rows.map((p) => ({
      doc: {
        id: p.id,
        nameId: p.nameId,
        nameEn: p.nameEn,
        categoryName: p.category?.nameId ?? '',
        skuText: p.variants.map((v) => v.sku).join(' '),
      },
      row: {
        id: p.id,
        nameId: p.nameId,
        nameEn: p.nameEn,
        slug: p.slug,
        shortDescriptionId: p.shortDescriptionId,
        isHalal: p.isHalal,
        isActive: p.isActive,
        createdAt: p.createdAt,
        category: p.category
          ? { id: p.category.id, nameId: p.category.nameId, slug: p.category.slug }
          : null,
        variants: p.variants.map((v) => ({
          id: v.id,
          nameId: v.nameId,
          nameEn: v.nameEn,
          sku: v.sku,
          price: v.price,
          stock: v.stock,
          weightGram: v.weightGram,
          isActive: v.isActive,
          sortOrder: v.sortOrder,
        })),
        images: p.images.map((img) => ({
          cloudinaryUrl: img.cloudinaryUrl,
          sortOrder: img.sortOrder,
        })),
      },
    }));

    const rankedDocs = rankProducts(
      rankable.map((r) => r.doc),
      q,
      limit
    );
    const byId = new Map(rankable.map((r) => [r.doc.id, r.row]));
    const results = rankedDocs
      .map((d) => byId.get(d.id))
      .filter((r): r is RankableProduct['row'] => Boolean(r));

    return success({ query: q, count: results.length, products: results });
  } catch (error) {
    logger.error('[search/products]', {
      error: error instanceof Error ? error.message : String(error),
    });
    return serverError(error);
  }
}, 'public');
