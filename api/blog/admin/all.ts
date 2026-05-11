import { error, ok } from "../../../lib/api-response";
import { requireAdmin } from "../../../lib/auth";
import { storage } from "../../../lib/storage";

export const config = { runtime: "nodejs" };

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET") {
    return new Response(JSON.stringify(error("METHOD_NOT_ALLOWED", "Method not allowed", 405)), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const sessionResponse = new Response();
  try {
    const auth = await requireAdmin(request, sessionResponse);
    if (auth instanceof Response) return auth;

    const allPosts = await storage.getAllBlogPosts();
    return new Response(JSON.stringify(ok(allPosts)), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify(error("FETCH_FAILED", "Failed to fetch all blog posts", 500)), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
