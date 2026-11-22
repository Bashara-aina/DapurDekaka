import { unstable_cache } from 'next/cache';
import { db } from '@/lib/db';
import { products, productVariants, categories } from '@/lib/db/schema';
import { eq, and, isNull, desc, lt } from 'drizzle-orm';

const PRODUCTS_PER_PAGE = 20;

/**
 * Cached store catalog reads — cuts Neon hits on repeated catalog browses.
 * Invalidate via revalidateTag('products') after admin product mutations.
 */
export const getCatalogPage = unstable_cache(
  async (categorySlug: string | undefined, cursor: string | undefined) => {
    const conditions = [eq(products.isActive, true), isNull(products.deletedAt)];

    if (categorySlug) {
      const category = await db.query.categories.findFirst({
        where: eq(categories.slug, categorySlug),
      });
      if (category) {
        conditions.push(eq(products.categoryId, category.id));
      }
    }

    const cursorClause = cursor
      ? lt(products.createdAt, new Date(cursor))
      : undefined;

    const productsList = await db.query.products.findMany({
      where: cursor
        ? and(...conditions, cursorClause)
        : and(...conditions),
      with: {
        variants: { where: eq(productVariants.isActive, true) },
        images: { orderBy: (images, { asc }) => [asc(images.sortOrder)] },
        category: true,
      },
      limit: PRODUCTS_PER_PAGE,
      orderBy: [desc(products.createdAt)],
    });

    const nextCursor =
      productsList.length === PRODUCTS_PER_PAGE
        ? productsList[productsList.length - 1]?.createdAt.toISOString() ?? null
        : null;

    return { productsList, nextCursor };
  },
  ['store-catalog-page'],
  { revalidate: 300, tags: ['products'] }
);

export const getCatalogCategories = unstable_cache(
  async () => {
    const allActiveProducts = await db.query.products.findMany({
      where: and(eq(products.isActive, true), isNull(products.deletedAt)),
      columns: { categoryId: true },
    });
    const categoryIdsWithProducts = new Set(
      allActiveProducts.map((p) => p.categoryId)
    );

    const allCategoriesRaw = await db.query.categories.findMany({
      where: eq(categories.isActive, true),
      orderBy: [categories.sortOrder],
    });

    return allCategoriesRaw
      .filter((cat) => categoryIdsWithProducts.has(cat.id))
      .map((c) => ({ id: c.id, nameId: c.nameId, slug: c.slug }));
  },
  ['store-catalog-categories'],
  { revalidate: 300, tags: ['products', 'categories'] }
);

export { PRODUCTS_PER_PAGE };
