import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import contactRouter from "./routes/contact";
import { blogRouter } from "./routes/blog";
import { pagesRouter } from "./routes/pages";
import menuRouter from "./routes/menu";
import aboutRouter from "./routes/about";
import bcrypt from "bcryptjs";
import session from "express-session";
import { requireAuth } from "./auth";
import { menuData, saucesData } from "@shared/menu-data";

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

  // Apply routers
  app.use("/api/menu", menuRouter);
  app.use("/api/blog", blogRouter);
  app.use("/api/pages", pagesRouter);
  app.use(contactRouter);
  app.use("/api/about", aboutRouter); // Added aboutRouter

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

  const httpServer = createServer(app);
  return httpServer;
}

// Mark function as not awaited to improve server startup time
export function initializeMenuItems() {
  console.log("Starting menu items initialization...");
  
  // Move initialization to background process
  Promise.resolve().then(async () => {
    try {
      // Check items and sauces in parallel
      const [existingItems, existingSauces] = await Promise.all([
        storage.getAllMenuItems(),
        storage.getAllSauces()
      ]);

      // Create menu items if needed (in background)
      if (existingItems.length === 0) {
        console.log("No existing menu items found. Creating...");
        
        // Process items in batches for better performance
        const batchSize = 5;
        for (let i = 0; i < menuData.length; i += batchSize) {
          const batch = menuData.slice(i, i + batchSize);
          await Promise.all(batch.map(item => 
            storage.createMenuItem({
              name: item.name,
              description: item.description,
              price: item.price,
              imageUrl: item.imageUrl,
              category: item.category,
            }).catch(error => 
              console.error(`Failed to create menu item ${item.name}:`, error)
            )
          ));
        }
        console.log("Initialized menu items successfully");
      } else {
        console.log(`Found ${existingItems.length} existing menu items. Skipping initialization.`);
      }

      // Create sauces if needed (in background)
      if (existingSauces.length === 0) {
        console.log("No existing sauces found. Creating...");
        await Promise.all(saucesData.map(sauce => 
          storage.createSauce({
            name: sauce.name,
            description: sauce.description,
            price: sauce.price,
            imageUrl: sauce.imageUrl,
            category: sauce.category,
          }).catch(error =>
            console.error(`Failed to create sauce ${sauce.name}:`, error)
          )
        ));
        console.log("Initialized sauces successfully");
      } else {
        console.log(`Found ${existingSauces.length} existing sauces. Skipping initialization.`);
      }
    } catch (error) {
      console.error("Failed to initialize menu items and sauces:", error);
    }
  });
}