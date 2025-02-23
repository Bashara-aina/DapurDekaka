import { Router } from "express";
import multer from "multer";
import path from "path";
import { storage } from "../storage";
import { insertMenuItemSchema, insertSauceSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { requireAuth } from "../auth";

// Enhanced multer configuration with detailed logging
const upload = multer({ 
  storage: multer.diskStorage({
    destination: 'uploads/',
    filename: (_req, file, cb) => {
      console.log('\n=== Multer File Processing ===');
      console.log('Processing uploaded file:', {
        fieldname: file.fieldname,
        originalname: file.originalname,
        mimetype: file.mimetype,
        encoding: file.encoding
      });
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (_req, file, cb) => {
    console.log('\n=== Multer File Validation ===');
    console.log('Validating file:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      encoding: file.encoding
    });

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
    const sauces = await storage.getAllSauces();
    res.json(sauces);
  } catch (error) {
    console.error("Failed to fetch sauces:", error);
    res.status(500).json({ message: "Failed to fetch sauces" });
  }
});

// Enhanced create menu item route with detailed request parsing logs
menuRouter.post("/items", requireAuth, upload.single('imageFile'), async (req, res) => {
  console.log('\n=== Incoming Request Debug ===');
  console.log('Request Headers:', {
    'content-type': req.headers['content-type'],
    'content-length': req.headers['content-length'],
    'authorization': req.headers.authorization ? 'Present' : 'Missing'
  });

  console.log('\n=== Parsed Form Fields ===');
  console.log('Body Fields:', req.body);

  console.log('\n=== Uploaded File Details ===');
  console.log('File:', req.file ? {
    fieldname: req.file.fieldname,
    originalname: req.file.originalname,
    encoding: req.file.encoding,
    mimetype: req.file.mimetype,
    size: req.file.size,
    destination: req.file.destination,
    filename: req.file.filename,
    path: req.file.path
  } : 'No file uploaded');

  try {
    // Field validation with detailed logging
    if (!req.body.name || !req.body.description) {
      console.log('\n=== Validation Failed ===');
      console.log('Missing Required Fields:', {
        name: Boolean(req.body.name),
        description: Boolean(req.body.description)
      });
      return res.status(400).json({ 
        message: "Name and description are required",
        receivedFields: {
          name: Boolean(req.body.name),
          description: Boolean(req.body.description)
        }
      });
    }

    if (!req.file) {
      console.log('\n=== Validation Failed ===');
      console.log('Missing Required File: imageFile');
      return res.status(400).json({ message: "Image file is required" });
    }

    const data = {
      name: req.body.name,
      description: req.body.description,
      imageUrl: `/uploads/${req.file.filename}`
    };

    console.log('\n=== Processing Data ===');
    console.log('Prepared Data:', data);

    // Schema validation
    const validation = insertMenuItemSchema.safeParse(data);
    if (!validation.success) {
      console.log('\n=== Schema Validation Failed ===');
      console.log('Validation Errors:', validation.error.errors);
      return res.status(400).json({ 
        message: fromZodError(validation.error).message,
        details: validation.error.errors
      });
    }

    console.log('\n=== Creating Menu Item ===');
    const menuItem = await storage.createMenuItem(validation.data);

    console.log('\n=== Success ===');
    console.log('Created Menu Item:', menuItem);
    res.status(201).json(menuItem);
  } catch (error) {
    console.error('\n=== Error ===');
    console.error('Failed to create menu item:', error);
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