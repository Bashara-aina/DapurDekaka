import { error, ok } from "../../../lib/api-response";
import { storage } from "../../../lib/storage";

export const config = {
  runtime: "nodejs",
};

const PUBLIC_CACHE_CONTROL = "public, max-age=60, s-maxage=300, stale-while-revalidate=86400";

function json(body: unknown, status: number, cacheable = false): Response {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (cacheable) {
    headers["Cache-Control"] = PUBLIC_CACHE_CONTROL;
  }
  return new Response(JSON.stringify(body), { status, headers });
}

export default async function handler(request: Request): Promise<Response> {
  try {
    if (request.method !== "GET") {
      return json(error("METHOD_NOT_ALLOWED", "Method not allowed", 405), 405);
    }

    const allPosts = await storage.getAllBlogPosts();
    const siteUrl = process.env.SITE_URL || "https://dapurdekaka.com";

    const staticPages = [
      { url: "/", priority: "1.0", changefreq: "daily" },
      { url: "/menu", priority: "0.8", changefreq: "weekly" },
      { url: "/articles", priority: "0.9", changefreq: "daily" },
      { url: "/contact", priority: "0.6", changefreq: "monthly" },
      { url: "/about", priority: "0.6", changefreq: "monthly" },
    ];

    const blogPages = allPosts
      .filter((post) => post.published === 1)
      .map((post) => ({
        url: `/article/${post.id}`,
        lastmod: post.updatedAt ? new Date(post.updatedAt).toISOString() : new Date(post.createdAt).toISOString(),
        priority: "0.7",
        changefreq: "weekly",
      }));

    const pages = [...staticPages.map((page) => ({ ...page, lastmod: new Date().toISOString() })), ...blogPages];
    return json(ok({ pages, siteUrl }), 200, true);
  } catch {
    return json(error("SITEMAP_FAILED", "Failed to fetch sitemap data", 500), 500);
  }
}
