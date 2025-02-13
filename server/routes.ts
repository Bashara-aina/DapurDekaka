import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMenuItemSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { menuData } from "@shared/menu-data";
import contactRouter from "./routes/contact";

export async function initializeMenuItems() {
  try {
    // Check if menu items already exist
    const existingItems = await storage.getAllMenuItems();
    if (existingItems.length === 0) {
      // Add initial menu items
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

export function registerRoutes(app: Express): Server {
  // Initialize menu items when the server starts
  initializeMenuItems();

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

  app.get("/api/menu/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.getMenuItem(id);
      if (!item) {
        return res.status(404).json({ message: "Menu item not found" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch menu item" });
    }
  });

  app.post("/api/menu", async (req, res) => {
    try {
      const result = insertMenuItemSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          message: fromZodError(result.error).message,
        });
      }
      const newItem = await storage.createMenuItem(result.data);
      res.status(201).json(newItem);
    } catch (error) {
      res.status(500).json({ message: "Failed to create menu item" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}