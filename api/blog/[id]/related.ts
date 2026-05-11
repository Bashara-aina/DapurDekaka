import { error, ok } from "@lib/api-response";
import { storage } from "@lib/storage";

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

function parseId(request: Request): number | null {
  const pathname = new URL(request.url).pathname;
  const match = pathname.match(/\/api\/blog\/(\d+)\/related\/?$/);
  if (!match) return null;
  const id = Number.parseInt(match[1], 10);
  return Number.isNaN(id) ? null : id;
}

export default async function handler(request: Request): Promise<Response> {
  try {
    if (request.method !== "GET") {
      return json(error("METHOD_NOT_ALLOWED", "Method not allowed", 405), 405);
    }

    const id = parseId(request);
    if (!id) {
      return json(error("VALIDATION_ERROR", "Invalid blog post id", 400), 400);
    }

    const url = new URL(request.url);
    const limit = Math.min(10, Math.max(1, parseInteger(url.searchParams.get("limit"), 3)));
    const relatedPosts = await storage.getRelatedBlogPosts(id, limit);
    return json(ok(relatedPosts), 200, true);
  } catch {
    return json(error("FETCH_FAILED", "Failed to fetch related posts", 500), 500);
  }
}
