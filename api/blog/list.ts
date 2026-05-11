import { error, ok } from "@lib/api-response";
import { storage } from "@lib/storage";

export const config = { runtime: "nodejs" };

const CACHE_CONTROL = "public, max-age=60, s-maxage=300, stale-while-revalidate=86400";

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET") {
    return new Response(JSON.stringify(error("METHOD_NOT_ALLOWED", "Method not allowed", 405)), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(20, Math.max(1, parseInt(searchParams.get("limit") ?? "10", 10)));

    const result = await storage.getPublishedBlogPosts({ limit });
    const slim = result.posts.map(({ content: _content, ...rest }) => rest);

    return new Response(JSON.stringify(ok(slim)), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": CACHE_CONTROL },
    });
  } catch {
    return new Response(JSON.stringify(error("FETCH_FAILED", "Failed to fetch blog list", 500)), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
