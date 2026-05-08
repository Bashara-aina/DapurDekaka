import { z } from "zod";
import { error, ok } from "../../lib/api-response";
import { requireAdmin, requireAuth } from "../../lib/auth";
import { storage } from "../../lib/storage";

export const config = {
  runtime: "nodejs",
};

const reorderSchema = z.object({
  postIds: z.array(z.number().int().positive()).min(1),
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async function handler(request: Request): Promise<Response> {
  try {
    if (request.method !== "POST") {
      return json(error("METHOD_NOT_ALLOWED", "Method not allowed", 405), 405);
    }

    const authResponse = new Response(null);
    const unauthorized = await requireAuth(request, authResponse);
    if (unauthorized) return unauthorized;

    const forbidden = await requireAdmin(request, authResponse);
    if (forbidden) return forbidden;

    const payload = (await request.json()) as unknown;
    const validation = reorderSchema.safeParse(payload);
    if (!validation.success) {
      return json(error("VALIDATION_ERROR", "Invalid post IDs provided", 400), 400);
    }

    const reordered = await storage.reorderBlogPosts(validation.data.postIds);
    return json(ok(reordered), 200);
  } catch {
    return json(error("REORDER_FAILED", "Failed to reorder blog posts", 500), 500);
  }
}
