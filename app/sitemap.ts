import type { MetadataRoute } from 'next';
import { db } from '@/lib/db';
import { products, blogPosts } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://dapurdekaka.com';

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
      url: `${BASE_URL}/cart`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];

  // Get active products
  try {
    const allProducts = await db.query.products.findMany({
      where: eq(products.isActive, true),
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
  } catch {
    // DB not available, skip products
  }

  // Get published blog posts
  try {
    const allPosts = await db.query.blogPosts.findMany({
      where: eq(blogPosts.isPublished, true),
      columns: {
        slug: true,
        updatedAt: true,
      },
    });

    const blogUrls: MetadataRoute.Sitemap = allPosts.map((post) => ({
      url: `${BASE_URL}/blog/${post.slug}`,
      lastModified: post.updatedAt ? new Date(post.updatedAt) : new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }));

    routes.push(...blogUrls);
  } catch {
    // DB not available, skip blog posts
  }

  return routes;
}