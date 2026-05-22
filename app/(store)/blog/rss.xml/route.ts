import { MetadataRoute } from 'next';
import { db } from '@/lib/db';
import { blogPosts, blogCategories } from '@/lib/db/schema';
import { eq, desc, and, isNull, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://dapurdekaka.com';

  let posts: Array<{
    slug: string;
    titleId: string;
    excerptId: string | null;
    contentId: string;
    coverImageUrl: string | null;
    publishedAt: Date | null;
    category: { nameId: string } | null;
  }> = [];

  try {
    posts = await db.query.blogPosts.findMany({
      where: and(eq(blogPosts.isPublished, true), isNull(blogPosts.deletedAt)),
      orderBy: [desc(blogPosts.publishedAt)],
      limit: 50,
      with: { category: true },
    });
  } catch {
    // DB unavailable — return empty feed
  }

  const itemsXml = posts
    .filter((p) => p.publishedAt)
    .map((post) => {
      const title = escapeXml(post.titleId);
      const link = `${BASE_URL}/blog/${post.slug}`;
      const pubDate = post.publishedAt ? new Date(post.publishedAt).toUTCString() : new Date().toUTCString();
      const description = escapeXml(post.excerptId || post.contentId.replace(/<[^>]+>/g, '').slice(0, 200));
      const imageUrl = post.coverImageUrl || '';
      const category = post.category ? escapeXml(post.category.nameId) : '';

      return `    <item>
      <title>${title}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${description}</description>
      ${category ? `<category>${category}</category>` : ''}
      ${imageUrl ? `<enclosure url="${escapeXml(imageUrl)}" type="image/jpeg" />` : ''}
    </item>`;
    })
    .join('\n');

  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Dapur Dekaka Blog</title>
    <link>https://dapurdekaka.com/blog</link>
    <description>Artikel dan tips seputar makanan frozen, resep, dan informasi menarik dari Dapur Dekaka. Cita rasa warisan Chinese-Indonesia, kini di rumahmu.</description>
    <language>id</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${BASE_URL}/blog/rss.xml" rel="self" type="application/rss+xml" />
    <image>
      <url>https://dapurdekaka.com/assets/logo/logo.png</url>
      <title>Dapur Dekaka Blog</title>
      <link>https://dapurdekaka.com/blog</link>
    </image>
${itemsXml}
  </channel>
</rss>`;

  return new Response(rssXml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}