import { NextRequest, NextResponse } from 'next/server';
import { success, serverError, notFound } from '@/lib/utils/api-response';
import { db } from '@/lib/db';
import { products } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const product = await db.query.products.findFirst({
      where: and(
        eq(products.slug, slug),
        isNull(products.deletedAt)
      ),
      with: {
        category: true,
        variants: {
          where: (variants, { eq }) => eq(variants.isActive, true),
          orderBy: (variants, { asc }) => [asc(variants.sortOrder)],
        },
        images: {
          orderBy: (images, { asc }) => [asc(images.sortOrder)],
        },
      },
    });

    if (!product) {
      return notFound('Produk tidak ditemukan');
    }

    return success(product);

  } catch (error) {
    console.error('[api/products/[slug]]', error);
    return serverError(error);
  }
}