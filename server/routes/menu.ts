import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage } from "../storage";
import { insertMenuItemSchema, insertSauceSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { requireAuth, requireAdmin } from "../auth";
import { ok, created, error } from "../apiResponse";
import { logger } from "../utils/logger";
import { MAX_FILE_SIZE } from "../storage";

// Create uploads directory if it doesn't exist
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Enhanced multer configuration
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Received ${file.mimetype}. Only JPEG, PNG and WebP are allowed.`));
    }
  }
});

export const menuRouter = Router();

// Get all menu items
menuRouter.get("/items", async (_req, res) => {
  try {
    const items = await storage.getAllMenuItems();
    res.status(200).json(ok(items));
  } catch (err) {
    logger.error("Failed to fetch menu items", { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json(error("FETCH_FAILED", "Failed to fetch menu items", 500));
  }
});

// Get all sauces
menuRouter.get("/sauces", async (_req, res) => {
  try {
    const allSauces = await storage.getAllSauces();
    res.status(200).json(ok(allSauces));
  } catch (err) {
    logger.error("Failed to fetch sauces", { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json(error("FETCH_FAILED", "Failed to fetch sauces", 500));
  }
});

// Enhanced create menu item route
menuRouter.post("/items", requireAuth, requireAdmin, upload.single('imageFile'), async (req, res) => {
  try {
    logger.debug("Creating menu item", { hasFile: !!req.file });

    if (!req.file) {
      return res.status(400).json(error("IMAGE_REQUIRED", "Image file is required", 400));
    }

    if (!req.body.name || !req.body.description) {
      return res.status(400).json(error("VALIDATION_FAILED", "Name and description are required", 400));
    }

    const data = {
      name: req.body.name,
      description: req.body.description,
      price: req.body.price || "0",
      imageUrl: `/uploads/${req.file.filename}`
    };

    const validation = insertMenuItemSchema.safeParse(data);
    if (!validation.success) {
      return res.status(400).json(error("VALIDATION_FAILED", fromZodError(validation.error).message, 400));
    }

    const menuItem = await storage.createMenuItem(validation.data);
    res.status(201).json(created(menuItem));
  } catch (err) {
    logger.error("Error creating menu item", { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json(error("CREATE_FAILED", "Failed to create menu item", 500));
  }
});

// Create sauce (protected)
menuRouter.post("/sauces", requireAuth, requireAdmin, upload.single("imageFile"), async (req, res) => {
  try {
    logger.debug("Creating sauce", { hasFile: !!req.file });

    if (!req.file) {
      return res.status(400).json(error("IMAGE_REQUIRED", "Image file is required", 400));
    }

    if (!req.body.name || !req.body.description) {
      return res.status(400).json(error("VALIDATION_FAILED", "Name and description are required", 400));
    }

    const data = {
      name: req.body.name,
      description: req.body.description,
      price: req.body.price || "0",
      imageUrl: `/uploads/${req.file.filename}`
    };

    const validation = insertSauceSchema.safeParse(data);
    if (!validation.success) {
      return res.status(400).json(error("VALIDATION_FAILED", fromZodError(validation.error).message, 400));
    }

    const newSauce = await storage.createSauce(validation.data);
    res.status(201).json(created(newSauce));
  } catch (err) {
    logger.error("Error creating sauce", { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json(error("CREATE_FAILED", "Failed to create sauce", 500));
  }
});

// Update menu item (protected)
menuRouter.put("/items/:id", requireAuth, requireAdmin, upload.single('imageFile'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json(error("INVALID_ID", "Invalid menu item ID", 400));
    }

    // Check if menu item exists
    const existingItem = await storage.getMenuItem(id);
    if (!existingItem) {
      return res.status(404).json(error("NOT_FOUND", "Menu item not found", 404));
    }

    // Prepare update data
    const updateData = {
      name: req.body.name,
      description: req.body.description,
      price: req.body.price,
      imageUrl: req.file ? `/uploads/${req.file.filename}` : req.body.imageUrl,
    };

    // Validate update data
    const validation = insertMenuItemSchema.partial().safeParse(updateData);
    if (!validation.success) {
      return res.status(400).json(error("VALIDATION_FAILED", fromZodError(validation.error).message, 400));
    }

    // Update the menu item
    const menuItem = await storage.updateMenuItem(id, validation.data);
    if (!menuItem) {
      return res.status(404).json(error("NOT_FOUND", "Menu item not found", 404));
    }

    res.status(200).json(ok(menuItem));
  } catch (err) {
    logger.error("Failed to update menu item", { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json(error("UPDATE_FAILED", "Failed to update menu item", 500));
  }
});

// Update sauce (protected)
menuRouter.put("/sauces/:id", requireAuth, requireAdmin, upload.single('imageFile'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json(error("INVALID_ID", "Invalid sauce ID", 400));
    }

    const data = {
      ...req.body,
      imageUrl: req.file ? `/uploads/${req.file.filename}` : req.body.imageUrl,
    };

    const validation = insertSauceSchema.safeParse(data);
    if (!validation.success) {
      return res.status(400).json(error("VALIDATION_FAILED", fromZodError(validation.error).message, 400));
    }

    const sauce = await storage.updateSauce(id, validation.data);
    if (!sauce) {
      return res.status(404).json(error("NOT_FOUND", "Sauce not found", 404));
    }
    res.status(200).json(ok(sauce));
  } catch (err) {
    logger.error("Failed to update sauce", { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json(error("UPDATE_FAILED", "Failed to update sauce", 500));
  }
});

// Delete menu item (protected)
menuRouter.delete("/items/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const success = await storage.deleteMenuItem(id);
    if (!success) {
      return res.status(404).json(error("NOT_FOUND", "Menu item not found", 404));
    }
    res.status(204).send();
  } catch (err) {
    logger.error("Failed to delete menu item", { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json(error("DELETE_FAILED", "Failed to delete menu item", 500));
  }
});

// Delete sauce (protected)
menuRouter.delete("/sauces/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const success = await storage.deleteSauce(id);
    if (!success) {
      return res.status(404).json(error("NOT_FOUND", "Sauce not found", 404));
    }
    res.status(204).send();
  } catch (err) {
    logger.error("Failed to delete sauce", { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json(error("DELETE_FAILED", "Failed to delete sauce", 500));
  }
});

// Reorder menu items (protected)
menuRouter.post("/items/reorder", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { itemIds } = req.body;

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json(error("VALIDATION_FAILED", "Invalid item IDs. Expected a non-empty array of menu item IDs.", 400));
    }

    // Validate that all IDs are numbers
    const numericIds = itemIds.map(id => Number(id));
    if (numericIds.some(id => isNaN(id))) {
      return res.status(400).json(error("VALIDATION_FAILED", "All item IDs must be numeric values.", 400));
    }

    // Perform the reordering
    const updatedItems = await storage.reorderMenuItems(numericIds);
    res.status(200).json(ok(updatedItems));
  } catch (err) {
    logger.error("Failed to reorder menu items", { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json(error("REORDER_FAILED", "Failed to reorder menu items", 500));
  }
});

// Reorder sauces (protected)
menuRouter.post("/sauces/reorder", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { sauceIds } = req.body;

    if (!Array.isArray(sauceIds) || sauceIds.length === 0) {
      return res.status(400).json(error("VALIDATION_FAILED", "Invalid sauce IDs. Expected a non-empty array of sauce IDs.", 400));
    }

    // Validate that all IDs are numbers
    const numericIds = sauceIds.map(id => Number(id));
    if (numericIds.some(id => isNaN(id))) {
      return res.status(400).json(error("VALIDATION_FAILED", "All sauce IDs must be numeric values.", 400));
    }

    // Perform the reordering
    const updatedSauces = await storage.reorderSauces(numericIds);
    res.status(200).json(ok(updatedSauces));
  } catch (err) {
    logger.error("Failed to reorder sauces", { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json(error("REORDER_FAILED", "Failed to reorder sauces", 500));
  }
});

export default menuRouter;