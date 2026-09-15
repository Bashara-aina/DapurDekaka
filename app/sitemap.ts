import type { MetadataRoute } from 'next';
import { db } from '@/lib/db';
import { products, blogPosts } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { logger } from '@/lib/utils/logger';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${BASE_URL}/products`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/blog`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/b2b`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/b2b/products`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/b2b/quote`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/trust`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/privacy-policy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/refund-policy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];

  // Get active products
  try {
    const allProducts = await db.query.products.findMany({
      where: and(eq(products.isActive, true), isNull(products.deletedAt)),
      columns: {
        slug: true,
        updatedAt: true,
      },
    });

    const productUrls: MetadataRoute.Sitemap = allProducts.map((product) => ({
      url: `${BASE_URL}/products/${product.slug}`,
      lastModified: product.updatedAt ? new Date(product.updatedAt) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));

    routes.push(...productUrls);
  } catch (err) {
    // DB not available (e.g. build without env) — serve static routes only.
    logger.warn('[sitemap] products query failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Get published blog posts
  try {
    const allPosts = await db.query.blogPosts.findMany({
      where: and(eq(blogPosts.isPublished, true), isNull(blogPosts.deletedAt)),
      columns: {
        slug: true,
        updatedAt: true,
      },
    });

    const blogUrls: MetadataRoute.Sitemap = allPosts.map((post) => ({
      url: `${BASE_URL}/blog/${post.slug}`,
      lastModified: post.updatedAt ? new Date(post.updatedAt) : new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.75,
    }));

    routes.push(...blogUrls);
  } catch (err) {
    // DB not available (e.g. build without env) — serve static routes only.
    logger.warn('[sitemap] blog posts query failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return routes;
}