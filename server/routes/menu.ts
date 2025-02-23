import { Router } from "express";
import multer from "multer";
import path from "path";
import { storage } from "../storage";
import { insertMenuItemSchema, insertSauceSchema } from "@shared/schema";
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

export const menuRouter = Router();

// Get all menu items
menuRouter.get("/items", async (_req, res) => {
  try {
    const items = await storage.getAllMenuItems();
    res.json(items);
  } catch (error) {
    console.error("Failed to fetch menu items:", error);
    res.status(500).json({ message: "Failed to fetch menu items" });
  }
});

// Get all sauces
menuRouter.get("/sauces", async (_req, res) => {
  try {
    const sauces = await storage.getAllSauces();
    res.json(sauces);
  } catch (error) {
    console.error("Failed to fetch sauces:", error);
    res.status(500).json({ message: "Failed to fetch sauces" });
  }
});

// Create menu item (protected)
menuRouter.post("/items", requireAuth, upload.single('image'), async (req, res) => {
  try {
    // Enhanced request logging
    console.log('Creating menu item - Request details:', {
      body: req.body,
      file: req.file ? {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: req.file.path
      } : 'No file uploaded',
      headers: {
        'content-type': req.headers['content-type'],
        'content-length': req.headers['content-length']
      }
    });

    // Validate required fields
    if (!req.body.name || !req.body.description) {
      console.log('Validation failed - Missing required fields:', {
        name: Boolean(req.body.name),
        description: Boolean(req.body.description)
      });
      return res.status(400).json({ 
        message: "Name and description are required",
        fields: {
          name: Boolean(req.body.name),
          description: Boolean(req.body.description)
        }
      });
    }

    if (!req.file) {
      console.log('Validation failed - No image file received');
      return res.status(400).json({ message: "Image file is required" });
    }

    const data = {
      name: req.body.name,
      description: req.body.description,
      imageUrl: `/uploads/${req.file.filename}`
    };

    console.log('Attempting to validate data:', data);

    const validation = insertMenuItemSchema.safeParse(data);
    if (!validation.success) {
      const errorMessage = fromZodError(validation.error).message;
      console.log('Schema validation failed:', {
        error: errorMessage,
        details: validation.error.errors
      });
      return res.status(400).json({ 
        message: errorMessage,
        details: validation.error.errors
      });
    }

    console.log('Creating menu item with validated data:', validation.data);
    const menuItem = await storage.createMenuItem(validation.data);

    console.log('Menu item created successfully:', menuItem);
    res.status(201).json(menuItem);
  } catch (error) {
    console.error("Failed to create menu item:", error);
    res.status(500).json({ 
      message: "Failed to create menu item",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Create sauce (protected)
menuRouter.post("/sauces", requireAuth, upload.single('image'), async (req, res) => {
  try {
    const data = {
      name: req.body.name,
      description: req.body.description,
      imageUrl: req.file ? `/uploads/${req.file.filename}` : req.body.imageUrl,
    };

    const validation = insertSauceSchema.safeParse(data);
    if (!validation.success) {
      return res.status(400).json({ 
        message: fromZodError(validation.error).message,
        details: validation.error.errors 
      });
    }

    const sauce = await storage.createSauce(validation.data);
    res.status(201).json(sauce);
  } catch (error) {
    console.error("Failed to create sauce:", error);
    res.status(500).json({ message: "Failed to create sauce" });
  }
});

// Update menu item (protected)
menuRouter.put("/items/:id", requireAuth, upload.single('image'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const data = {
      ...req.body,
      imageUrl: req.file ? `/uploads/${req.file.filename}` : req.body.imageUrl,
    };

    const validation = insertMenuItemSchema.safeParse(data);
    if (!validation.success) {
      return res.status(400).json({ message: fromZodError(validation.error).message });
    }

    const menuItem = await storage.updateMenuItem(id, validation.data);
    if (!menuItem) {
      return res.status(404).json({ message: "Menu item not found" });
    }
    res.json(menuItem);
  } catch (error) {
    console.error("Failed to update menu item:", error);
    res.status(500).json({ message: "Failed to update menu item" });
  }
});

// Update sauce (protected)
menuRouter.put("/sauces/:id", requireAuth, upload.single('image'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const data = {
      ...req.body,
      imageUrl: req.file ? `/uploads/${req.file.filename}` : req.body.imageUrl,
    };

    const validation = insertSauceSchema.safeParse(data);
    if (!validation.success) {
      return res.status(400).json({ message: fromZodError(validation.error).message });
    }

    const sauce = await storage.updateSauce(id, validation.data);
    if (!sauce) {
      return res.status(404).json({ message: "Sauce not found" });
    }
    res.json(sauce);
  } catch (error) {
    console.error("Failed to update sauce:", error);
    res.status(500).json({ message: "Failed to update sauce" });
  }
});

// Delete menu item (protected)
menuRouter.delete("/items/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const success = await storage.deleteMenuItem(id);
    if (!success) {
      return res.status(404).json({ message: "Menu item not found" });
    }
    res.status(204).send();
  } catch (error) {
    console.error("Failed to delete menu item:", error);
    res.status(500).json({ message: "Failed to delete menu item" });
  }
});

// Delete sauce (protected)
menuRouter.delete("/sauces/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const success = await storage.deleteSauce(id);
    if (!success) {
      return res.status(404).json({ message: "Sauce not found" });
    }
    res.status(204).send();
  } catch (error) {
    console.error("Failed to delete sauce:", error);
    res.status(500).json({ message: "Failed to delete sauce" });
  }
});

export default menuRouter;