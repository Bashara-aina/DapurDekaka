import { error, ok } from "@lib/api-response";
import { requireAdmin } from "@lib/auth";
import { storage } from "@lib/storage";

export const config = { runtime: "nodejs" };

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(JSON.stringify(error("METHOD_NOT_ALLOWED", "Method not allowed", 405)), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const sessionResponse = new Response();
  try {
    const authResult = await requireAdmin(request, sessionResponse);
    if (authResult instanceof Response) return authResult;

    const body: unknown = await request.json();
    const bodyObj = body as { postIds?: unknown };
    const { postIds } = bodyObj;

    if (!Array.isArray(postIds) || postIds.length === 0) {
      return new Response(JSON.stringify(error("VALIDATION_ERROR", "Invalid post IDs provided", 400)), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const reorderedPosts = await storage.reorderBlogPosts(
      postIds.map((id: string | number) =>
        typeof id === "string" ? Number.parseInt(id, 10) : id
      )
    );
    return new Response(JSON.stringify(ok(reorderedPosts)), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify(error("REORDER_FAILED", "Failed to reorder blog posts", 500)), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
