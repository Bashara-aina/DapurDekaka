import { z } from "zod";
import { error, ok } from "../../../../lib/api-response";
import { requireAdmin } from "../../../../lib/auth";
import { storage } from "../../../../lib/storage";

export const config = { runtime: "nodejs" };

const reorderSchema = z.object({
  images: z.array(z.string()),
});

const homepageSchema = z.object({
  carousel: z.object({
    images: z.array(z.string()),
    title: z.string(),
    subtitle: z.string(),
  }),
  logo: z.string(),
  content: z.object({
    hero: z.object({ title: z.string(), subtitle: z.string() }),
    carousel: z.object({ title: z.string(), subtitle: z.string() }),
    featuredProducts: z.object({ title: z.string(), subtitle: z.string() }),
    latestArticles: z.object({ title: z.string(), subtitle: z.string() }),
    customers: z.object({
      title: z.string(),
      subtitle: z.string(),
      logos: z.array(z.string()),
    }),
  }),
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "PUT") {
    return json(error("METHOD_NOT_ALLOWED", "Method not allowed", 405), 405);
  }

  const authGate = await requireAdmin(request, new Response());
  if (authGate instanceof Response) return authGate;

  try {
    const payload = reorderSchema.safeParse((await request.json()) as unknown);
    if (!payload.success) {
      return json(error("VALIDATION_ERROR", "Invalid image array provided", 400), 400);
    }

    const current = await storage.getPageContent("homepage");
    const parsed = homepageSchema.safeParse(current?.content);
    if (!parsed.success) {
      return json(error("NOT_FOUND", "Homepage content not found", 404), 404);
    }

    parsed.data.carousel.images = payload.data.images;
    await storage.updatePageContent("homepage", { content: parsed.data });
    return json(ok({ message: "Image order updated successfully" }));
  } catch {
    return json(error("REORDER_FAILED", "Failed to reorder images", 500), 500);
  }
}
