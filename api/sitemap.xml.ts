import { storage } from "@lib/storage";

export const config = { runtime: "nodejs" };

interface StaticPage {
  url: string;
  priority: string;
  changefreq: string;
}

function dateOnly(dateValue: Date | string | null | undefined): string {
  if (!dateValue) {
    return new Date().toISOString().split("T")[0];
  }

  return new Date(dateValue).toISOString().split("T")[0];
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const siteUrl = process.env.SITE_URL ?? "https://dapurdekaka.com";
    const allPosts = await storage.getAllBlogPosts();
    const publishedPosts = allPosts.filter((post) => post.published === 1);

    const staticPages: StaticPage[] = [
      { url: "/", priority: "1.0", changefreq: "daily" },
      { url: "/menu", priority: "0.8", changefreq: "weekly" },
      { url: "/articles", priority: "0.9", changefreq: "daily" },
      { url: "/contact", priority: "0.6", changefreq: "monthly" },
      { url: "/about", priority: "0.6", changefreq: "monthly" },
    ];

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    const today = dateOnly(new Date());
    for (const page of staticPages) {
      xml += "  <url>\n";
      xml += `    <loc>${siteUrl}${page.url}</loc>\n`;
      xml += `    <lastmod>${today}</lastmod>\n`;
      xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
      xml += `    <priority>${page.priority}</priority>\n`;
      xml += "  </url>\n";
    }

    for (const post of publishedPosts) {
      xml += "  <url>\n";
      xml += `    <loc>${siteUrl}/article/${post.id}</loc>\n`;
      xml += `    <lastmod>${dateOnly(post.updatedAt ?? post.createdAt)}</lastmod>\n`;
      xml += "  </url>\n";
    }

    xml += "</urlset>";

    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return new Response("Error generating sitemap", { status: 500 });
  }
}
