
import { Router } from "express";
import multer from "multer";
import path from "path";
import { db } from "../db";
import { blogPosts } from "../schema";
import { authenticateToken } from "../auth";

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

export const blogRouter = Router();

// Create post
blogRouter.post("/", authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { title, content, published } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
    
    const post = await db.insert(blogPosts).values({
      title,
      content,
      imageUrl,
      authorId: req.user.id,
      published: published ? 1 : 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).returning();
    
    res.status(201).json(post[0]);
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({ error: "Failed to create post" });
  }
});

// Get all posts
blogRouter.get("/", async (req, res) => {
  try {
    const allPosts = await db
      .select()
      .from(blogPosts)
      .where(blogPosts.published.equals(1))
      .orderBy(blogPosts.createdAt.desc());
    res.json(allPosts);
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});

// Get single post
blogRouter.get("/:id", async (req, res) => {
  try {
    const post = await db
      .select()
      .from(blogPosts)
      .where(blogPosts.id.equals(parseInt(req.params.id)))
      .limit(1);
    
    if (post.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }
    
    res.json(post[0]);
  } catch (error) {
    console.error("Error fetching post:", error);
    res.status(500).json({ error: "Failed to fetch post" });
  }
});

// Update post
blogRouter.put("/:id", authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { title, content, published } = req.body;
    const updateData: any = {
      title,
      content,
      published: published ? 1 : 0,
      updatedAt: new Date().toISOString(),
    };

    if (req.file) {
      updateData.imageUrl = `/uploads/${req.file.filename}`;
    }

    const post = await db
      .update(blogPosts)
      .set(updateData)
      .where(blogPosts.id.equals(parseInt(req.params.id)))
      .returning();

    res.json(post[0]);
  } catch (error) {
    console.error("Error updating post:", error);
    res.status(500).json({ error: "Failed to update post" });
  }
});

// Delete post
blogRouter.delete("/:id", authenticateToken, async (req, res) => {
  try {
    await db
      .delete(blogPosts)
      .where(blogPosts.id.equals(parseInt(req.params.id)));
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting post:", error);
    res.status(500).json({ error: "Failed to delete post" });
  }
});
