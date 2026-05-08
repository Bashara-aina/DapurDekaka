import { Router, type Response } from "express";
import multer from "multer";
import path from "path";
import { storage } from "../storage";
import { insertBlogPostSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { requireAuth, requireAdmin } from "../auth";
import { ok, created, error } from "../apiResponse";
import { logger } from "../utils/logger";

const upload = multer({
  storage: multer.diskStorage({
    destination: 'uploads/',
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG and WebP are allowed.'));
    }
  }
});

/** Generate a kebab-case slug from a title */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/** Calculate read time in minutes from HTML content */
function calculateReadTime(content: string): number {
  const stripped = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const wordCount = stripped.split(' ').filter(Boolean).length;
  return Math.ceil(wordCount / 200);
}

export const blogRouter = Router();

const setPublicCacheHeaders = (res: Response) => {
  res.set("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=86400");
};

// Create post
blogRouter.post("/", requireAuth, requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const { title, content, excerpt, published, authorName, slug, category, featured } = req.body;

    // Validate input
    const validation = insertBlogPostSchema.safeParse({
      title,
      content,
      excerpt: excerpt || undefined,
      published: published === 'true' || published === '1' ? 1 : 0,
      imageUrl: undefined,
      authorName: authorName || undefined,
      slug: slug || undefined,
      category: category || undefined,
      featured: featured === 'true' || featured === '1' ? 1 : 0,
    });

    if (!validation.success) {
      return res.status(400).json(error("VALIDATION_FAILED", fromZodError(validation.error).message, 400));
    }

    // Auto-generate slug from title if not provided
    const finalSlug = validation.data.slug || generateSlug(title);

    // Check for slug uniqueness
    const existingPost = await storage.getBlogPostBySlug(finalSlug);
    if (existingPost) {
      return res.status(409).json(error("SLUG_EXISTS", "A post with this slug already exists. Please use a different slug.", 409));
    }

    const readTime = calculateReadTime(content);

    // Create blog post
    const createdPost = await storage.createBlogPost({
      ...validation.data,
      slug: finalSlug,
      readTime,
      authorId: req.session.userId!,
      imageUrl: req.file ? `/uploads/${req.file.filename}` : undefined
    });

    res.status(201).json(created(createdPost));
  } catch (err) {
    logger.error("Error creating blog post", { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json(error("CREATE_FAILED", "Failed to create blog post", 500));
  }
});

// Get all posts (public with pagination and filters)
blogRouter.get("/", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));
    const category = req.query.category as string | undefined;
    const featured = req.query.featured === 'true' ? true : req.query.featured === 'false' ? false : undefined;
    const author = req.query.author as string | undefined;
    const search = req.query.search as string | undefined;
    const fields = req.query.fields as string | undefined;

    const result = await storage.getPublishedBlogPosts({
      page,
      limit,
      category,
      featured,
      author,
      search
    });

    // Slim payload: exclude full HTML content for list views
    const slim = fields !== 'full' ? result.posts.map(({ content: _content, ...rest }) => rest) : result.posts;

    setPublicCacheHeaders(res);
    res.status(200).json(ok(slim, { total: result.total, page, limit, totalPages: result.totalPages }));
  } catch (err) {
    logger.error("Error fetching blog posts", { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json(error("FETCH_FAILED", "Failed to fetch blog posts", 500));
  }
});

// Lightweight list endpoint for feeds — full content excluded
blogRouter.get("/list", async (req, res) => {
  try {
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit as string) || 10));

    const result = await storage.getPublishedBlogPosts({ limit });

    const slim = result.posts.map(({ content: _content, ...rest }) => rest);

    setPublicCacheHeaders(res);
    res.status(200).json(ok(slim));
  } catch (err) {
    logger.error("Error fetching blog list", { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json(error("FETCH_FAILED", "Failed to fetch blog list", 500));
  }
});

// Get all posts for admin (including drafts) - auth required
blogRouter.get("/admin/all", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const allPosts = await storage.getAllBlogPosts();
    res.status(200).json(ok(allPosts));
  } catch (err) {
    logger.error("Error fetching all blog posts for admin", { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json(error("FETCH_FAILED", "Failed to fetch blog posts", 500));
  }
});

// Get single post
blogRouter.get("/:id", async (req, res) => {
  try {
    setPublicCacheHeaders(res);
    const id = parseInt(req.params.id);
    const post = await storage.getBlogPost(id);

    if (!post) {
      return res.status(404).json(error("NOT_FOUND", "Blog post not found", 404));
    }

    res.status(200).json(ok(post));
  } catch (err) {
    logger.error("Error fetching blog post", { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json(error("FETCH_FAILED", "Failed to fetch blog post", 500));
  }
});

// Get related posts for an article
blogRouter.get("/:id/related", async (req, res) => {
  try {
    setPublicCacheHeaders(res);
    const id = parseInt(req.params.id);
    const limit = Math.min(10, Math.max(1, parseInt(req.query.limit as string) || 3));

    const relatedPosts = await storage.getRelatedBlogPosts(id, limit);

    res.status(200).json(ok(relatedPosts));
  } catch (err) {
    logger.error("Error fetching related posts", { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json(error("FETCH_FAILED", "Failed to fetch related posts", 500));
  }
});

// Update post
blogRouter.put("/:id", requireAuth, requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const post = await storage.getBlogPost(id);

    if (!post) {
      return res.status(404).json(error("NOT_FOUND", "Blog post not found", 404));
    }

    // Authorization: only author or admin can update
    const currentUserId = req.session.userId;
    const isAuthor = post.authorId === currentUserId;
    if (!isAuthor) {
      return res.status(403).json(error("FORBIDDEN", "You are not authorized to update this post", 403));
    }

    const { title, content, excerpt, published, authorName, slug, category, featured } = req.body;
    const validation = insertBlogPostSchema.partial().safeParse({
      title,
      content,
      excerpt: excerpt || undefined,
      published: published === 'true' || published === '1' ? 1 : (published === 'false' || published === '0' ? 0 : undefined),
      authorName: authorName || undefined,
      slug: slug || undefined,
      category: category || undefined,
      featured: featured === 'true' || featured === '1' ? 1 : (featured === 'false' || featured === '0' ? 0 : undefined),
    });

    if (!validation.success) {
      return res.status(400).json(error("VALIDATION_FAILED", fromZodError(validation.error).message, 400));
    }

    // Check for slug uniqueness if slug is being changed
    if (validation.data.slug) {
      const existingPost = await storage.getBlogPostBySlug(validation.data.slug);
      if (existingPost && existingPost.id !== id) {
        return res.status(409).json(error("SLUG_EXISTS", "A post with this slug already exists. Please use a different slug.", 409));
      }
    }

    const updateData: Record<string, unknown> = {
      ...validation.data,
    };

    if (req.file) {
      updateData.imageUrl = `/uploads/${req.file.filename}`;
    }

    // Recalculate readTime if content changed
    if (validation.data.content) {
      updateData.readTime = calculateReadTime(validation.data.content);
    }

    // Auto-generate slug from title if title changed and slug not explicitly provided
    if (validation.data.title && !validation.data.slug && !post.slug) {
      updateData.slug = generateSlug(validation.data.title);
    }

    const updatedPost = await storage.updateBlogPost(id, updateData);
    res.status(200).json(ok(updatedPost));
  } catch (err) {
    logger.error("Error updating blog post", { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json(error("UPDATE_FAILED", "Failed to update blog post", 500));
  }
});

// Delete post
blogRouter.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const post = await storage.getBlogPost(id);

    if (!post) {
      return res.status(404).json(error("NOT_FOUND", "Blog post not found", 404));
    }

    // Authorization: only author or admin can delete
    const currentUserId = req.session.userId;
    const isAuthor = post.authorId === currentUserId;
    if (!isAuthor) {
      return res.status(403).json(error("FORBIDDEN", "You are not authorized to delete this post", 403));
    }

    await storage.deleteBlogPost(id);
    res.status(204).send();
  } catch (err) {
    logger.error("Error deleting blog post", { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json(error("DELETE_FAILED", "Failed to delete blog post", 500));
  }
});

// Reorder blog posts
blogRouter.post("/reorder", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { postIds } = req.body;

    if (!Array.isArray(postIds) || postIds.length === 0) {
      return res.status(400).json(error("VALIDATION_ERROR", "Invalid post IDs provided", 400));
    }

    // Convert strings to numbers if needed
    const numericPostIds = postIds.map(id => typeof id === 'string' ? parseInt(id) : id);

    // Reorder posts
    const reorderedPosts = await storage.reorderBlogPosts(numericPostIds);
    res.status(200).json(ok(reorderedPosts));
  } catch (err) {
    logger.error("Error reordering blog posts", { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json(error("REORDER_FAILED", "Failed to reorder blog posts", 500));
  }
});

// Get all posts for sitemap (public)
blogRouter.get("/sitemap/all", async (_req, res) => {
  try {
    const allPosts = await storage.getAllBlogPosts();
    const siteUrl = process.env.SITE_URL || 'https://dapurdekaka.com';

    const staticPages = [
      { url: '/', priority: '1.0', changefreq: 'daily' },
      { url: '/menu', priority: '0.8', changefreq: 'weekly' },
      { url: '/articles', priority: '0.9', changefreq: 'daily' },
      { url: '/contact', priority: '0.6', changefreq: 'monthly' },
      { url: '/about', priority: '0.6', changefreq: 'monthly' },
    ];

    const blogPosts = allPosts
      .filter(post => post.published === 1)
      .map(post => ({
        url: `/article/${post.id}`,
        lastmod: post.updatedAt ? new Date(post.updatedAt).toISOString() : new Date(post.createdAt).toISOString(),
        priority: '0.7',
        changefreq: 'weekly'
      }));

    const allUrls = [
      ...staticPages.map(p => ({ ...p, lastmod: new Date().toISOString() })),
      ...blogPosts
    ];

    res.status(200).json(ok({ pages: allUrls, siteUrl }));
  } catch (err) {
    logger.error("Error fetching sitemap data", { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json(error("SITEMAP_FAILED", "Failed to fetch sitemap data", 500));
  }
});