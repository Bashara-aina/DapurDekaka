
import { Router } from "express";
import multer from "multer";
import { db } from "../db";
import { posts } from "../schema";

export const blogRouter = Router();
const upload = multer({ dest: "uploads/" });

blogRouter.post("/", upload.single("image"), async (req, res) => {
  try {
    const { title, content } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
    
    await db.insert(posts).values({
      title,
      content,
      imageUrl,
      createdAt: new Date().toISOString(),
    });
    
    res.status(201).json({ message: "Post created successfully" });
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({ error: "Failed to create post" });
  }
});

blogRouter.get("/", async (req, res) => {
  try {
    const allPosts = await db.select().from(posts).orderBy(posts.createdAt);
    res.json(allPosts);
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});

blogRouter.get("/:id", async (req, res) => {
  try {
    const post = await db
      .select()
      .from(posts)
      .where(posts.id.equals(req.params.id))
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
