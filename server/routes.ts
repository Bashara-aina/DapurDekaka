import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMenuItemSchema, insertBlogPostSchema, insertUserSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { menuData } from "@shared/menu-data";
import contactRouter from "./routes/contact";
import bcrypt from "bcryptjs";
import session from "express-session";

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

export function registerRoutes(app: Express): Server {
  // Initialize menu items when the server starts
  initializeMenuItems();

  // Session middleware with secure settings
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "your-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      },
    })
  );

  // Authentication middleware
  const requireAuth = async (req: any, res: any, next: any) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      req.user = user;
      next();
    } catch (error) {
      console.error("Auth middleware error:", error);
      res.status(500).json({ message: "Authentication error" });
    }
  };

  // User routes
  app.post("/api/register", async (req, res) => {
    try {
      const { username, email, password } = req.body;

      // Validate input
      const validation = insertUserSchema.safeParse({ username, email, password });
      if (!validation.success) {
        return res.status(400).json({ message: fromZodError(validation.error).message });
      }

      // Check if user exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already taken" });
      }

      // Create user
      const newUser = await storage.createUser({
        username,
        email,
        password,
      });

      // Set session
      req.session.userId = newUser.id;
      res.status(201).json({ message: "User registered successfully" });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Failed to register user" });
    }
  });

  app.post("/api/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await storage.getUserByUsername(username);

      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      req.session.userId = user.id;
      res.json({ message: "Logged in successfully" });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Blog post routes
  app.get("/api/blog", async (req, res) => {
    try {
      const posts = await storage.getAllBlogPosts();
      res.json(posts);
    } catch (error) {
      console.error("Fetch posts error:", error);
      res.status(500).json({ message: "Failed to fetch blog posts" });
    }
  });

  app.post("/api/blog", requireAuth, async (req, res) => {
    try {
      const { title, content, published } = req.body;

      if (!req.session.userId) {
        return res.status(401).json({ message: "Unauthorized - Please log in" });
      }

      // Validate input
      const validation = insertBlogPostSchema.safeParse({
        title,
        content,
        published: published ? 1 : 0,
      });

      if (!validation.success) {
        return res.status(400).json({
          message: fromZodError(validation.error).message,
        });
      }

      // Create blog post with author ID from session
      const createdPost = await storage.createBlogPost({
        ...validation.data,
        authorId: req.session.userId,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      if (!createdPost) {
        return res.status(500).json({ message: "Failed to create blog post" });
      }

      res.status(201).json(createdPost);
    } catch (error) {
      console.error("Blog post creation error:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to create blog post" 
      });
    }
  });

  app.put("/api/blog/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const post = await storage.getBlogPost(id);

      if (!post) {
        return res.status(404).json({ message: "Blog post not found" });
      }

      if (post.authorId !== req.session.userId) {
        return res.status(403).json({ message: "Unauthorized to edit this post" });
      }

      const result = insertBlogPostSchema.partial().safeParse({
        ...req.body,
        updatedAt: new Date()
      });

      if (!result.success) {
        return res.status(400).json({
          message: fromZodError(result.error).message,
        });
      }

      const updatedPost = await storage.updateBlogPost(id, result.data);
      res.json(updatedPost);
    } catch (error) {
      res.status(500).json({ message: "Failed to update blog post" });
    }
  });

  app.delete("/api/blog/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const post = await storage.getBlogPost(id);

      if (!post) {
        return res.status(404).json({ message: "Blog post not found" });
      }

      if (post.authorId !== req.session.userId) {
        return res.status(403).json({ message: "Unauthorized to delete this post" });
      }

      await storage.deleteBlogPost(id);
      res.json({ message: "Blog post deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete blog post" });
    }
  });

  // Register contact form routes
  app.use(contactRouter);

  // Menu items routes
  app.get("/api/menu", async (_req, res) => {
    try {
      const items = await storage.getAllMenuItems();
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch menu items" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

export async function initializeMenuItems() {
  try {
    const existingItems = await storage.getAllMenuItems();
    if (existingItems.length === 0) {
      for (const item of menuData) {
        await storage.createMenuItem({
          name: item.name,
          description: item.description,
          price: item.price,
          imageUrl: item.imageUrl,
          category: item.category,
        });
      }
      console.log("Initialized menu items successfully");
    }
  } catch (error) {
    console.error("Failed to initialize menu items:", error);
  }
}