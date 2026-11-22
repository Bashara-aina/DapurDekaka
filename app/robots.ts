import type { MetadataRoute } from 'next';
import { isFlagEnabled } from '@/lib/config/feature-flags';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.dapurdekaka.com').replace(
  /\/$/,
  ''
);

/**
 * SEO3: single robots source. Soft launch blocks indexing until announce.
 */
export default function robots(): MetadataRoute.Robots {
  if (isFlagEnabled('softLaunch')) {
    return {
      rules: [
        {
          userAgent: '*',
          disallow: '/',
        },
      ],
      sitemap: `${BASE_URL}/sitemap.xml`,
    };
  }

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
