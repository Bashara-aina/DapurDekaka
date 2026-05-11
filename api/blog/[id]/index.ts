import { z } from "zod";
import { error, ok } from "../../../lib/api-response";
import { requireAdmin } from "../../../lib/auth";
import { uploadFile } from "../../../lib/blob";
import { storage } from "../../../lib/storage";

export const config = { runtime: "nodejs" };

function json(body: unknown, status: number, extra?: Record<string, string>): Response {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (extra?.["Cache-Control"]) headers["Cache-Control"] = extra["Cache-Control"];
  return new Response(JSON.stringify(body), { status, headers });
}

function parseId(request: Request): number | null {
  const match = new URL(request.url).pathname.match(/\/api\/blog\/(\d+)\/?$/);
  if (!match) return null;
  const id = Number.parseInt(match[1], 10);
  return Number.isNaN(id) ? null : id;
}

function generateSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").trim();
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

const updateSchema = z.object({
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
  const id = parseId(request);
  if (!id) return json(error("VALIDATION_ERROR", "Invalid blog post id", 400), 400);

  if (request.method === "GET") {
    const post = await storage.getBlogPost(id);
    if (!post) return json(error("NOT_FOUND", "Blog post not found", 404), 404);
    return json(ok(post), 200, { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400" });
  }

  if (request.method === "PUT") {
    const sessionResponse = new Response();
    const authGate = await requireAdmin(request, sessionResponse);
    if (authGate instanceof Response) return authGate;
    const existing = await storage.getBlogPost(id);
    if (!existing) return json(error("NOT_FOUND", "Blog post not found", 404), 404);
    if (existing.authorId !== authGate.userId) return json(error("FORBIDDEN", "You are not authorized to update this post", 403), 403);
    const formData = await request.formData();
    const slugVal = formData.get("slug");
    const updateData: Record<string, unknown> = {};
    const titleVal = formData.get("title");
    if (typeof titleVal === "string") updateData.title = titleVal;
    const contentVal = formData.get("content");
    if (typeof contentVal === "string") {
      updateData.content = contentVal;
      updateData.readTime = calculateReadTime(contentVal);
    }
    const excerptVal = formData.get("excerpt");
    if (typeof excerptVal === "string") updateData.excerpt = excerptVal;
    const publishedVal = formData.get("published");
    if (publishedVal != null) updateData.published = parseOptionalFlag(publishedVal);
    const slugInput = typeof slugVal === "string" && slugVal ? slugVal : undefined;
    if (slugInput) {
      updateData.slug = slugInput;
    } else if (titleVal && !existing.slug) {
      updateData.slug = generateSlug(String(titleVal));
    }
    const categoryVal = formData.get("category");
    if (typeof categoryVal === "string") updateData.category = categoryVal;
    const featuredVal = formData.get("featured");
    if (featuredVal != null) updateData.featured = parseOptionalFlag(featuredVal);
    const imageVal = formData.get("image");
    if (imageVal instanceof File && imageVal.size > 0) updateData.imageUrl = await uploadFile(imageVal, "blog");
    if (slugInput) {
      const slugPost = await storage.getBlogPostBySlug(slugInput);
      if (slugPost && slugPost.id !== id) return json(error("SLUG_EXISTS", "A post with this slug already exists", 409), 409);
    }
    const updated = await storage.updateBlogPost(id, updateData);
    return json(ok(updated), 200);
  }

  if (request.method === "DELETE") {
    const sessionResponse = new Response();
    const authGate = await requireAdmin(request, sessionResponse);
    if (authGate instanceof Response) return authGate;
    const post = await storage.getBlogPost(id);
    if (!post) return json(error("NOT_FOUND", "Blog post not found", 404), 404);
    if (post.authorId !== authGate.userId) return json(error("FORBIDDEN", "You are not authorized to delete this post", 403), 403);
    await storage.deleteBlogPost(id);
    return new Response(null, { status: 204 });
  }

  return json(error("METHOD_NOT_ALLOWED", "Method not allowed", 405), 405);
}
