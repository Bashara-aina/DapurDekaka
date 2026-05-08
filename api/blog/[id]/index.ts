import { z } from "zod";
import { error, ok } from "../../../lib/api-response";
import { requireAdmin, requireAuth } from "../../../lib/auth";
import { uploadFile } from "../../../lib/blob";
import { getSession } from "../../../lib/session";
import { storage } from "../../../lib/storage";

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

function parseId(request: Request): number | null {
  const pathname = new URL(request.url).pathname;
  const match = pathname.match(/\/api\/blog\/(\d+)\/?$/);
  if (!match) return null;
  const id = Number.parseInt(match[1], 10);
  return Number.isNaN(id) ? null : id;
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

function calculateReadTime(content: string): number {
  const stripped = content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const wordCount = stripped.length === 0 ? 0 : stripped.split(" ").filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 200));
}

function parseOptionalFlag(value: FormDataEntryValue | null): number | undefined {
  if (typeof value !== "string") return undefined;
  if (value === "true" || value === "1") return 1;
  if (value === "false" || value === "0") return 0;
  return undefined;
}

const updatePayloadSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  excerpt: z.string().optional(),
  published: z.number().int().min(0).max(1).optional(),
  authorName: z.string().optional(),
  slug: z.string().optional(),
  category: z.string().optional(),
  featured: z.number().int().min(0).max(1).optional(),
});

export default async function handler(request: Request): Promise<Response> {
  try {
    const id = parseId(request);
    if (!id) {
      return json(error("VALIDATION_ERROR", "Invalid blog post id", 400), 400);
    }

    if (request.method === "GET") {
      const post = await storage.getBlogPost(id);
      if (!post) {
        return json(error("NOT_FOUND", "Blog post not found", 404), 404);
      }
      return json(ok(post), 200, true);
    }

    if (request.method === "PUT") {
      const authResponse = new Response(null);
      const unauthorized = await requireAuth(request, authResponse);
      if (unauthorized) return unauthorized;

      const forbidden = await requireAdmin(request, authResponse);
      if (forbidden) return forbidden;

      const session = await getSession(request, authResponse);
      if (!session.userId) {
        return json(error("UNAUTHORIZED", "Authentication required", 401), 401);
      }

      const existingPost = await storage.getBlogPost(id);
      if (!existingPost) {
        return json(error("NOT_FOUND", "Blog post not found", 404), 404);
      }

      if (existingPost.authorId !== session.userId) {
        return json(error("FORBIDDEN", "You are not authorized to update this post", 403), 403);
      }

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

      const validation = updatePayloadSchema.safeParse({
        title: typeof title === "string" ? title : undefined,
        content: typeof content === "string" ? content : undefined,
        excerpt: typeof excerpt === "string" && excerpt.length > 0 ? excerpt : undefined,
        published: parseOptionalFlag(published),
        authorName: typeof authorName === "string" && authorName.length > 0 ? authorName : undefined,
        slug: typeof slug === "string" && slug.length > 0 ? slug : undefined,
        category: typeof category === "string" && category.length > 0 ? category : undefined,
        featured: parseOptionalFlag(featured),
      });

      if (!validation.success) {
        return json(error("VALIDATION_FAILED", "Invalid blog payload", 400), 400);
      }

      const updateData: {
        title?: string;
        content?: string;
        excerpt?: string;
        published?: number;
        authorName?: string;
        slug?: string;
        category?: string;
        featured?: number;
        imageUrl?: string;
        readTime?: number;
      } = {
        ...validation.data,
      };

      if (validation.data.slug) {
        const slugPost = await storage.getBlogPostBySlug(validation.data.slug);
        if (slugPost && slugPost.id !== id) {
          return json(
            error("SLUG_EXISTS", "A post with this slug already exists. Please use a different slug.", 409),
            409,
          );
        }
      }

      if (validation.data.content) {
        updateData.readTime = calculateReadTime(validation.data.content);
      }

      if (validation.data.title && !validation.data.slug && !existingPost.slug) {
        const generatedSlug = generateSlug(validation.data.title);
        const slugPost = await storage.getBlogPostBySlug(generatedSlug);
        if (slugPost && slugPost.id !== id) {
          return json(
            error("SLUG_EXISTS", "A post with this slug already exists. Please use a different slug.", 409),
            409,
          );
        }
        updateData.slug = generatedSlug;
      }

      if (image instanceof File && image.size > 0) {
        updateData.imageUrl = await uploadFile(image, "blog");
      }

      const updatedPost = await storage.updateBlogPost(id, updateData);
      return json(ok(updatedPost), 200);
    }

    if (request.method === "DELETE") {
      const authResponse = new Response(null);
      const unauthorized = await requireAuth(request, authResponse);
      if (unauthorized) return unauthorized;

      const forbidden = await requireAdmin(request, authResponse);
      if (forbidden) return forbidden;

      const session = await getSession(request, authResponse);
      if (!session.userId) {
        return json(error("UNAUTHORIZED", "Authentication required", 401), 401);
      }

      const post = await storage.getBlogPost(id);
      if (!post) {
        return json(error("NOT_FOUND", "Blog post not found", 404), 404);
      }

      if (post.authorId !== session.userId) {
        return json(error("FORBIDDEN", "You are not authorized to delete this post", 403), 403);
      }

      await storage.deleteBlogPost(id);
      return new Response(null, { status: 204 });
    }

    return json(error("METHOD_NOT_ALLOWED", "Method not allowed", 405), 405);
  } catch {
    return json(error("INTERNAL_ERROR", "Failed to process blog post request", 500), 500);
  }
}
