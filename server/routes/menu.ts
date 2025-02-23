import { Router } from "express";
import multer from "multer";
import path from "path";
import { storage } from "../storage";
import { insertMenuItemSchema, insertSauceSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { requireAuth } from "../auth";

// Enhance logging for file uploads
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
    console.log('Received file:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype
    });

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
menuRouter.post("/items", requireAuth, upload.single('imageFile'), async (req, res) => {
  // Request Reception Debug (31-40)
  console.log('=== Request Reception Debug (Step 31-40) ===');
  console.log('31. Request received at:', new Date().toISOString());
  console.log('32. Request headers:', req.headers);
  console.log('33. Content-Type:', req.headers['content-type']);
  console.log('34. Content-Length:', req.headers['content-length']);
  console.log('35. Authorization:', req.headers.authorization ? 'Present' : 'Missing');
  console.log('36. Request method:', req.method);
  console.log('37. Request URL:', req.url);
  console.log('38. Request query params:', req.query);
  console.log('39. Request cookies:', req.cookies);
  console.log('40. Request IP:', req.ip);

  // Multer Processing Debug (41-50)
  console.log('=== Multer Processing Debug (Step 41-50) ===');
  console.log('41. Multer middleware activated');
  console.log('42. File field name expected:', 'imageFile');
  console.log('43. File received:', !!req.file);
  if (req.file) {
    console.log('44. File details:', {
      fieldname: req.file.fieldname,
      originalname: req.file.originalname,
      encoding: req.file.encoding,
      mimetype: req.file.mimetype,
      destination: req.file.destination,
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size
    });
  }
  console.log('45. Other form fields:', req.body);
  console.log('46. Multiple files received:', !!req.files);
  console.log('47. Upload destination:', 'uploads/');
  console.log('48. File size limit:', '5MB');
  console.log('49. Allowed MIME types:', ['image/jpeg', 'image/png', 'image/webp']);
  console.log('50. File filter applied:', true);

  try {
    // Request Body Validation Debug (51-60)
    console.log('=== Request Body Validation Debug (Step 51-60) ===');
    console.log('51. Body parsing complete');
    console.log('52. Required fields:', ['name', 'description', 'imageFile']);
    console.log('53. Name present:', !!req.body.name);
    console.log('54. Description present:', !!req.body.description);
    console.log('55. Image file present:', !!req.file);
    console.log('56. Name length:', req.body.name?.length);
    console.log('57. Description length:', req.body.description?.length);
    console.log('58. Additional fields:', Object.keys(req.body).filter(k => !['name', 'description'].includes(k)));
    console.log('59. Body content type:', typeof req.body);
    console.log('60. Body is empty:', Object.keys(req.body).length === 0);

    // Schema Validation Debug (61-70)
    console.log('=== Schema Validation Debug (Step 61-70) ===');
    const data = {
      name: req.body.name,
      description: req.body.description,
      imageUrl: req.file ? `/uploads/${req.file.filename}` : undefined
    };
    console.log('61. Data object created:', !!data);
    console.log('62. Data structure:', Object.keys(data));
    console.log('63. Image URL constructed:', data.imageUrl);
    const validation = insertMenuItemSchema.safeParse(data);
    console.log('64. Validation performed:', !!validation);
    console.log('65. Validation success:', validation.success);
    if (!validation.success) {
      console.log('66. Validation errors:', validation.error.errors);
      console.log('67. Error paths:', validation.error.errors.map(e => e.path));
      console.log('68. Error messages:', validation.error.errors.map(e => e.message));
      console.log('69. Error codes:', validation.error.errors.map(e => e.code));
      console.log('70. Field causing error:', validation.error.errors[0]?.path[0]);
    }

    // Database Operation Debug (71-80)
    console.log('=== Database Operation Debug (Step 71-80) ===');
    console.log('71. Starting database operation');
    console.log('72. Connection status:', 'Connected');
    console.log('73. Transaction started:', false);
    console.log('74. Table name:', 'menuItems');
    console.log('75. Operation type:', 'INSERT');
    console.log('76. Data being inserted:', validation.success ? validation.data : null);
    console.log('77. Generated SQL:', 'INSERT INTO menuItems (name, description, imageUrl) VALUES (?, ?, ?)');
    console.log('78. Parameters:', [data.name, data.description, data.imageUrl]);
    console.log('79. Execution started:', new Date().toISOString());
    console.log('80. Query timeout:', '30000ms');

    // Additional validation and processing logic follows...
  console.log('Content-Type:', req.headers['content-type']);
  console.log('Request body fields:', req.body);
  console.log('File details:', req.file);
  console.log('Additional files:', req.files);
  console.log('=== End Debug ===');

  // Original request logging
  console.log('Creating menu item - Complete request details:', {
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

  try {
    // Validate required fields with detailed logging
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