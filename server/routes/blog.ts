import { Router } from "express";
import multer from "multer";
import path from "path";
import { storage } from "../storage";
import { insertBlogPostSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { requireAuth } from "../auth";

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

export const blogRouter = Router();

// Create post
blogRouter.post("/", requireAuth, upload.single('image'), async (req, res) => {
  try {
    const { title, content, published } = req.body;

    // Validate input
    const validation = insertBlogPostSchema.safeParse({
      title,
      content,
      published: published === 'true' || published === '1' ? 1 : 0
    });

    if (!validation.success) {
      return res.status(400).json({
        message: fromZodError(validation.error).message
      });
    }

    // Create blog post
    const createdPost = await storage.createBlogPost({
      ...validation.data,
      authorId: req.session.userId!,
      imageUrl: req.file ? `/uploads/${req.file.filename}` : undefined
    });

    res.status(201).json(createdPost);
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({ 
      message: error instanceof Error ? error.message : "Failed to create blog post" 
    });
  }
});

// Get all posts
blogRouter.get("/", async (_req, res) => {
  try {
    const posts = await storage.getAllBlogPosts();
    res.json(posts);
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({ message: "Failed to fetch blog posts" });
  }
});

// Add this route after the GET "/" route
blogRouter.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const post = await storage.getBlogPost(id);

    if (!post) {
      return res.status(404).json({ message: "Blog post not found" });
    }

    res.json(post);
  } catch (error) {
    console.error("Error fetching post:", error);
    res.status(500).json({ message: "Failed to fetch blog post" });
  }
});

// Update post
blogRouter.put("/:id", requireAuth, upload.single('image'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const post = await storage.getBlogPost(id);

    if (!post) {
      return res.status(404).json({ message: "Blog post not found" });
    }

    // Any authenticated user can edit posts

    const { title, content, published } = req.body;
    const validation = insertBlogPostSchema.partial().safeParse({
      title,
      content,
      published: published === 'true' || published === '1' ? 1 : 0
    });

    if (!validation.success) {
      return res.status(400).json({
        message: fromZodError(validation.error).message
      });
    }

    const updateData = {
      ...validation.data,
      imageUrl: req.file ? `/uploads/${req.file.filename}` : undefined
    };

    const updatedPost = await storage.updateBlogPost(id, updateData);
    res.json(updatedPost);
  } catch (error) {
    console.error("Error updating post:", error);
    res.status(500).json({ message: "Failed to update blog post" });
  }
});

// Delete post
blogRouter.delete("/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const post = await storage.getBlogPost(id);

    if (!post) {
      return res.status(404).json({ message: "Blog post not found" });
    }

    // Any authenticated user can delete posts

    await storage.deleteBlogPost(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting post:", error);
    res.status(500).json({ message: "Failed to delete blog post" });
  }
});