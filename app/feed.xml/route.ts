import { db } from '@/lib/db';
import { blogPosts } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export const revalidate = 3600;

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  type PostWithRelations = Awaited<ReturnType<typeof db.query.blogPosts.findMany<{
    with: { category: true; author: true };
  }>>>[number];

  let posts: PostWithRelations[] = [];
  try {
    posts = await db.query.blogPosts.findMany({
      where: eq(blogPosts.isPublished, true),
      orderBy: [desc(blogPosts.publishedAt)],
      limit: 20,
      with: { category: true, author: true },
    });
  } catch {
    // DB unavailable at build/prerender time — serve empty feed
  }

  const baseUrl = 'https://dapurdekaka.com';

  const rssItems = posts
    .map((post) => {
      const postUrl = `${baseUrl}/blog/${post.slug}`;
      const title = escapeXml(post.titleId);
      const description = escapeXml(post.excerptId || '');
      const pubDate = post.publishedAt
        ? new Date(post.publishedAt).toUTCString()
        : new Date().toUTCString();
      const category = post.category ? escapeXml(post.category.nameId) : '';
      const author = post.author ? escapeXml(post.author.name) : 'Dapur Dekaka';

      return `
    <item>
      <title>${title}</title>
      <link>${postUrl}</link>
      <guid isPermaLink="true">${postUrl}</guid>
      <description>${description}</description>
      <pubDate>${pubDate}</pubDate>
      ${category ? `<category>${category}</category>` : ''}
      <author>${author}</author>
    </item>`;
    })
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Dapur Dekaka - Blog</title>
    <link>${baseUrl}/blog</link>
    <description>Artikel dan tips seputar makanan frozen, resep, dan informasi menarik dari Dapur Dekaka.</description>
    <language>id</language>
    <managingEditor>hello@dapurdekaka.com (Dapur Dekaka)</managingEditor>
    <webMaster>hello@dapurdekaka.com (Dapur Dekaka)</webMaster>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${baseUrl}/feed.xml" rel="self" type="application/rss+xml" />
    <image>
      <url>${baseUrl}/assets/logo/logo.png</url>
      <title>Dapur Dekaka - Blog</title>
      <link>${baseUrl}/blog</link>
    </image>${rssItems}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}