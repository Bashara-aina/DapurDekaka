import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage } from "../storage";
import { insertMenuItemSchema, insertSauceSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { requireAuth } from "../auth";

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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
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
    res.json(items);
  } catch (error) {
    console.error("Failed to fetch menu items:", error);
    res.status(500).json({ message: "Failed to fetch menu items" });
  }
});

// Get all sauces
menuRouter.get("/sauces", async (_req, res) => {
  try {
    const allSauces = await storage.getAllSauces();
    res.json(allSauces);
  } catch (error) {
    console.error("Failed to fetch sauces:", error);
    res.status(500).json({ message: "Failed to fetch sauces" });
  }
});

// Enhanced create menu item route
menuRouter.post("/items", requireAuth, upload.single('imageFile'), async (req, res) => {
  try {
    console.log('Request Body:', req.body);
    console.log('File:', req.file);

    if (!req.file) {
      return res.status(400).json({ 
        message: "Image file is required",
        requestBody: req.body
      });
    }

    if (!req.body.name || !req.body.description) {
      return res.status(400).json({
        message: "Name and description are required",
        receivedFields: {
          name: Boolean(req.body.name),
          description: Boolean(req.body.description)
        }
      });
    }

    const data = {
      name: req.body.name,
      description: req.body.description,
      imageUrl: `/uploads/${req.file.filename}`
    };

    console.log('Data to be inserted:', data);

    const validation = insertMenuItemSchema.safeParse(data);
    if (!validation.success) {
      return res.status(400).json({ 
        message: fromZodError(validation.error).message
      });
    }

    const menuItem = await storage.createMenuItem(validation.data);
    res.status(201).json(menuItem);
  } catch (error) {
    console.error('Error creating menu item:', error);
    res.status(500).json({ 
      message: "Failed to create menu item",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Create sauce (protected)
menuRouter.post("/sauces", requireAuth, upload.single("imageFile"), async (req, res) => {
  try {
    console.log("Creating sauce with data:", req.body);
    console.log("File received:", req.file);

    const imageFile = req.file;
    const { name, description } = req.body;

    // Validate required fields
    if (!name || !description) {
      console.log("Missing required fields in request");
      return res.status(400).json({ message: "Name and description are required" });
    }

    // Build sauce data object
    const sauceData = {
      name,
      description,
      // Include other required schema fields
      price: 0,  // Default price
      category: "sauce", // Default category
      imageUrl: imageFile ? `/uploads/${imageFile.filename}` : "/sauce/Chilli Oil.jpg", // Default image if none provided
    };

    console.log("Prepared sauce data:", sauceData);
    
    // Double check for required fields according to schema
    if (!sauceData.name || !sauceData.description || !sauceData.imageUrl) {
      console.log("Validation failed: Missing required fields after processing");
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Create the sauce
    console.log("Sending to storage:", sauceData);
    const newSauce = await storage.createSauce(sauceData);
    console.log("Successfully created sauce:", newSauce);
    
    res.status(201).json(newSauce);
  } catch (error) {
    console.error("Failed to create sauce - detailed error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error("Error message:", errorMessage);
    console.error("Error stack:", errorStack);
    
    res.status(500).json({ 
      message: "Failed to create sauce", 
      error: errorMessage,
      stack: errorStack
    });
  }
});

// Update menu item (protected)
menuRouter.put("/items/:id", requireAuth, upload.single('imageFile'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid menu item ID" });
    }

    // Check if menu item exists
    const existingItem = await storage.getMenuItem(id);
    if (!existingItem) {
      return res.status(404).json({ message: "Menu item not found" });
    }

    // Prepare update data
    const updateData = {
      name: req.body.name,
      description: req.body.description,
      imageUrl: req.file ? `/uploads/${req.file.filename}` : req.body.imageUrl,
    };

    // Validate update data
    const validation = insertMenuItemSchema.partial().safeParse(updateData);
    if (!validation.success) {
      return res.status(400).json({ 
        message: "Invalid data", 
        errors: fromZodError(validation.error).message 
      });
    }

    // Update the menu item
    const menuItem = await storage.updateMenuItem(id, validation.data);
    if (!menuItem) {
      return res.status(404).json({ message: "Menu item not found" });
    }

    res.json(menuItem);
  } catch (error) {
    console.error("Failed to update menu item:", error);
    res.status(500).json({ 
      message: "Failed to update menu item",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Update sauce (protected)
menuRouter.put("/sauces/:id", requireAuth, upload.single('imageFile'), async (req, res) => {
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