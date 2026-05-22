import { db } from '@/lib/db';
import { blogPosts } from '@/lib/db/schema';
import { eq, desc, and, isNull } from 'drizzle-orm';

export const revalidate = 3600;
export const dynamic = 'force-dynamic';

export async function GET() {
  const posts = await db.query.blogPosts.findMany({
    where: and(eq(blogPosts.isPublished, true), isNull(blogPosts.deletedAt)),
    orderBy: [desc(blogPosts.publishedAt)],
    limit: 20,
    with: { category: true },
  });

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Blog Dapur Dekaka</title>
    <link>https://dapurdekaka.com/blog</link>
    <description>Artikel dan tips seputar makanan frozen dari Dapur Dekaka</description>
    <language>id</language>
    <atom:link href="https://dapurdekaka.com/blog/rss.xml" rel="self" type="application/rss+xml"/>
    ${posts.map((post) => `
    <item>
      <title><![CDATA[${post.titleId}]]></title>
      <link>https://dapurdekaka.com/blog/${post.slug}</link>
      <guid>https://dapurdekaka.com/blog/${post.slug}</guid>
      <pubDate>${new Date(post.publishedAt!).toUTCString()}</pubDate>
      <description><![CDATA[${post.excerptId ?? ''}]]></description>
    </item>`).join('')}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 's-maxage=3600',
    },
  });
}