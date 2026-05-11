import { error, ok } from "../../lib/api-response";
import { storage } from "../../lib/storage";

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
    const id = searchParams.get("id");

    if (!id) {
      return new Response(JSON.stringify(error("INVALID_ID", "Missing post ID", 400)), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const limit = Math.min(10, Math.max(1, parseInt(searchParams.get("limit") ?? "3", 10)));
    const relatedPosts = await storage.getRelatedBlogPosts(Number(id), limit);

    return new Response(JSON.stringify(ok(relatedPosts)), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": CACHE_CONTROL },
    });
  } catch {
    return new Response(JSON.stringify(error("FETCH_FAILED", "Failed to fetch related posts", 500)), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
