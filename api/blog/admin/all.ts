import { error, ok } from "../../../lib/api-response";
import { requireAdmin, requireAuth } from "../../../lib/auth";
import { storage } from "../../../lib/storage";

export const config = {
  runtime: "nodejs",
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async function handler(request: Request): Promise<Response> {
  try {
    if (request.method !== "GET") {
      return json(error("METHOD_NOT_ALLOWED", "Method not allowed", 405), 405);
    }

    const authResponse = new Response(null);
    const unauthorized = await requireAuth(request, authResponse);
    if (unauthorized) return unauthorized;

    const forbidden = await requireAdmin(request, authResponse);
    if (forbidden) return forbidden;

    const posts = await storage.getAllBlogPosts();
    return json(ok(posts), 200);
  } catch {
    return json(error("FETCH_FAILED", "Failed to fetch blog posts", 500), 500);
  }
}
