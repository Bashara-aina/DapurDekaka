import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMenuItemSchema, insertUserSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { menuData } from "@shared/menu-data";
import contactRouter from "./routes/contact";
import { blogRouter } from "./routes/blog";
import pagesRouter from "./routes/pages";
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

  // Register blog routes
  app.get("/api/auth-check", requireAuth, (_req, res) => {
  res.json({ authenticated: true });
});

app.use("/api/blog", blogRouter);
app.use("/api/pages", pagesRouter);

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