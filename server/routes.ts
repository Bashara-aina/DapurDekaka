import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMenuItemSchema, insertUserSchema, insertSauceSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { menuData, saucesData } from "@shared/menu-data";
import contactRouter from "./routes/contact";
import { blogRouter } from "./routes/blog";
import { pagesRouter } from "./routes/pages";
import bcrypt from "bcryptjs";
import session from "express-session";
import multer from "multer";

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

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

  app.get("/api/auth-check", requireAuth, (_req, res) => {
    res.json({ authenticated: true });
  });

  // Menu items routes
  app.get("/api/menu/items", async (_req, res) => {
    try {
      const items = await storage.getAllMenuItems();
      res.json(items);
    } catch (error) {
      console.error("Failed to fetch menu items:", error);
      res.status(500).json({ message: "Failed to fetch menu items" });
    }
  });

  app.get("/api/menu/sauces", async (_req, res) => {
    try {
      const sauces = await storage.getAllSauces();
      res.json(sauces);
    } catch (error) {
      console.error("Failed to fetch sauces:", error);
      res.status(500).json({ message: "Failed to fetch sauces" });
    }
  });

  app.post("/api/menu/items", requireAuth, upload.single('image'), async (req, res) => {
    try {
      const data = {
        ...req.body,
        price: Number(req.body.price),
        imageUrl: req.file ? `/uploads/${req.file.filename}` : req.body.imageUrl,
      };

      const validation = insertMenuItemSchema.safeParse(data);
      if (!validation.success) {
        return res.status(400).json({ message: fromZodError(validation.error).message });
      }

      const menuItem = await storage.createMenuItem(validation.data);
      res.status(201).json(menuItem);
    } catch (error) {
      console.error("Failed to create menu item:", error);
      res.status(500).json({ message: "Failed to create menu item" });
    }
  });

  app.post("/api/menu/sauces", requireAuth, upload.single('image'), async (req, res) => {
    try {
      const data = {
        ...req.body,
        price: Number(req.body.price),
        imageUrl: req.file ? `/uploads/${req.file.filename}` : req.body.imageUrl,
      };

      const validation = insertSauceSchema.safeParse(data);
      if (!validation.success) {
        return res.status(400).json({ message: fromZodError(validation.error).message });
      }

      const sauce = await storage.createSauce(validation.data);
      res.status(201).json(sauce);
    } catch (error) {
      console.error("Failed to create sauce:", error);
      res.status(500).json({ message: "Failed to create sauce" });
    }
  });

  app.put("/api/menu/items/:id", requireAuth, upload.single('image'), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const data = {
        ...req.body,
        price: Number(req.body.price),
        imageUrl: req.file ? `/uploads/${req.file.filename}` : req.body.imageUrl,
      };

      const validation = insertMenuItemSchema.safeParse(data);
      if (!validation.success) {
        return res.status(400).json({ message: fromZodError(validation.error).message });
      }

      const menuItem = await storage.updateMenuItem(id, validation.data);
      res.json(menuItem);
    } catch (error) {
      console.error("Failed to update menu item:", error);
      res.status(500).json({ message: "Failed to update menu item" });
    }
  });

  app.put("/api/menu/sauces/:id", requireAuth, upload.single('image'), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const data = {
        ...req.body,
        price: Number(req.body.price),
        imageUrl: req.file ? `/uploads/${req.file.filename}` : req.body.imageUrl,
      };

      const validation = insertSauceSchema.safeParse(data);
      if (!validation.success) {
        return res.status(400).json({ message: fromZodError(validation.error).message });
      }

      const sauce = await storage.updateSauce(id, validation.data);
      res.json(sauce);
    } catch (error) {
      console.error("Failed to update sauce:", error);
      res.status(500).json({ message: "Failed to update sauce" });
    }
  });

  app.delete("/api/menu/items/:id", requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      await storage.deleteMenuItem(id);
      res.json({ message: "Menu item deleted successfully" });
    } catch (error) {
      console.error("Failed to delete menu item:", error);
      res.status(500).json({ message: "Failed to delete menu item" });
    }
  });

  app.delete("/api/menu/sauces/:id", requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      await storage.deleteSauce(id);
      res.json({ message: "Sauce deleted successfully" });
    } catch (error) {
      console.error("Failed to delete sauce:", error);
      res.status(500).json({ message: "Failed to delete sauce" });
    }
  });

  // Apply routers
  app.use("/api/blog", blogRouter);
  app.use("/api/pages", pagesRouter);
  app.use(contactRouter);

  const httpServer = createServer(app);
  return httpServer;
}

export async function initializeMenuItems() {
  try {
    const existingItems = await storage.getAllMenuItems();
    const existingSauces = await storage.getAllSauces();

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

    if (existingSauces.length === 0) {
      for (const sauce of saucesData) {
        await storage.createSauce({
          name: sauce.name,
          description: sauce.description,
          price: sauce.price,
          imageUrl: sauce.imageUrl,
          category: sauce.category,
        });
      }
      console.log("Initialized sauces successfully");
    }
  } catch (error) {
    console.error("Failed to initialize menu items and sauces:", error);
  }
}