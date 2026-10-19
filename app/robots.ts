import type { MetadataRoute } from 'next';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.dapurdekaka.com').replace(
  /\/$/,
  ''
);

/**
 * SEO3: single robots source. `public/robots.txt` and `next-sitemap` were
 * removed — this route (plus app/sitemap.ts) owns crawl directives.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/checkout/',
          '/account/',
          '/b2b/account/',
        ],
      },
      {
        // AI training crawlers may index storefront content but not scrape
        // training data from the whole site.
        userAgent: 'GPTBot',
        allow: ['/blog/', '/products/'],
        disallow: '/',
      },
      { userAgent: 'Google-Extended', allow: '/' },
      { userAgent: 'PerplexityBot', allow: '/' },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
