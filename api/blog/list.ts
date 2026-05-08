import { error, ok } from "../../lib/api-response";
import { storage } from "../../lib/storage";

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

function parseInteger(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export default async function handler(request: Request): Promise<Response> {
  try {
    if (request.method !== "GET") {
      return json(error("METHOD_NOT_ALLOWED", "Method not allowed", 405), 405);
    }

    const url = new URL(request.url);
    const limit = Math.min(20, Math.max(1, parseInteger(url.searchParams.get("limit"), 10)));
    const result = await storage.getPublishedBlogPosts({ limit });
    const posts = result.posts.map(({ content: _content, ...rest }) => rest);

    return json(ok(posts), 200, true);
  } catch {
    return json(error("FETCH_FAILED", "Failed to fetch blog list", 500), 500);
  }
}
