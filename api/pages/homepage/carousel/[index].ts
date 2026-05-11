import { z } from "zod";
import { error, ok } from "@lib/api-response";
import { requireAdmin } from "@lib/auth";
import { storage } from "@lib/storage";

export const config = { runtime: "nodejs" };

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

function readIndex(request: Request): number | null {
  const parts = new URL(request.url).pathname.split("/");
  const last = parts[parts.length - 1];
  const parsed = Number.parseInt(last, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "DELETE") {
    return json(error("METHOD_NOT_ALLOWED", "Method not allowed", 405), 405);
  }

  const authGate = await requireAdmin(request, new Response());
  if (authGate instanceof Response) return authGate;

  const index = readIndex(request);
  if (index === null) {
    return json(error("INVALID_INDEX", "Invalid image index", 400), 400);
  }

  try {
    const current = await storage.getPageContent("homepage");
    const parsed = homepageSchema.safeParse(current?.content);
    if (!parsed.success) {
      return json(error("NOT_FOUND", "Homepage content not found", 404), 404);
    }

    if (index >= parsed.data.carousel.images.length) {
      return json(error("NOT_FOUND", "Image not found", 404), 404);
    }

    parsed.data.carousel.images.splice(index, 1);
    await storage.updatePageContent("homepage", { content: parsed.data });
    return json(ok({ message: "Image deleted successfully" }));
  } catch {
    return json(error("DELETE_FAILED", "Failed to delete image", 500), 500);
  }
}
