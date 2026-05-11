import { z } from "zod";
import { created, error, ok } from "../../lib/api-response";
import { requireAdmin } from "../../lib/auth";
import { uploadFile } from "../../lib/blob";
import { storage } from "../../lib/storage";

export const config = { runtime: "nodejs" };

const PUBLIC_CACHE_CONTROL = "public, max-age=60, s-maxage=300, stale-while-revalidate=86400";

function json(body: unknown, status: number, cacheable = false): Response {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cacheable) headers["Cache-Control"] = PUBLIC_CACHE_CONTROL;
  return new Response(JSON.stringify(body), { status, headers });
}

function generateSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").trim();
}

function calculateReadTime(content: string): number {
  const stripped = content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const wordCount = stripped.length === 0 ? 0 : stripped.split(" ").filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 200));
}

function parseFlag(value: string | null): number {
  if (value === "true" || value === "1") return 1;
  return 0;
}

const createPayloadSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  excerpt: z.string().optional(),
  published: z.number().int().min(0).max(1),
  authorName: z.string().optional(),
  slug: z.string().optional(),
  category: z.string().optional(),
  featured: z.number().int().min(0).max(1),
});

export default async function handler(request: Request): Promise<Response> {
  try {
    if (request.method === "GET") {
      const url = new URL(request.url);
      const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
      const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "10", 10)));
      const category = url.searchParams.get("category") ?? undefined;
      const author = url.searchParams.get("author") ?? undefined;
      const search = url.searchParams.get("search") ?? undefined;
      const fields = url.searchParams.get("fields") ?? undefined;
      const featuredParam = url.searchParams.get("featured");
      const featured = featuredParam === "true" ? true : featuredParam === "false" ? false : undefined;

      const result = await storage.getPublishedBlogPosts({ page, limit, category, author, search, featured });
      const posts = fields === "full" ? result.posts : result.posts.map(({ content: _content, ...rest }) => rest);

      return json(ok(posts, { total: result.total, page, limit, totalPages: result.totalPages }), 200, true);
    }

    if (request.method === "POST") {
      const sessionResponse = new Response();
      const authGate = await requireAdmin(request, sessionResponse);
      if (authGate instanceof Response) return authGate;

      const formData = await request.formData();
      const title = formData.get("title");
      const content = formData.get("content");
      const excerpt = formData.get("excerpt");
      const published = formData.get("published");
      const authorName = formData.get("authorName");
      const slug = formData.get("slug");
      const category = formData.get("category");
      const featured = formData.get("featured");
      const image = formData.get("image");

      const validation = createPayloadSchema.safeParse({
        title: typeof title === "string" ? title : "",
        content: typeof content === "string" ? content : "",
        excerpt: typeof excerpt === "string" && excerpt.length > 0 ? excerpt : undefined,
        published: parseFlag(typeof published === "string" ? published : null),
        authorName: typeof authorName === "string" && authorName.length > 0 ? authorName : undefined,
        slug: typeof slug === "string" && slug.length > 0 ? slug : undefined,
        category: typeof category === "string" && category.length > 0 ? category : undefined,
        featured: parseFlag(typeof featured === "string" ? featured : null),
      });

      if (!validation.success) return json(error("VALIDATION_FAILED", "Invalid blog payload", 400), 400);

      const finalSlug = validation.data.slug ?? generateSlug(validation.data.title);
      const existingPost = await storage.getBlogPostBySlug(finalSlug);
      if (existingPost) return json(error("SLUG_EXISTS", "A post with this slug already exists", 409), 409);

      let imageUrl: string | undefined;
      if (image instanceof File && image.size > 0) imageUrl = await uploadFile(image, "blog");

      const createdPost = await storage.createBlogPost({
        ...validation.data,
        slug: finalSlug,
        readTime: calculateReadTime(validation.data.content),
        authorId: authGate.userId,
        imageUrl,
      });

      return json(created(createdPost), 201);
    }

    return json(error("METHOD_NOT_ALLOWED", "Method not allowed", 405), 405);
  } catch {
    return json(error("INTERNAL_ERROR", "Failed to process blog request", 500), 500);
  }
}
