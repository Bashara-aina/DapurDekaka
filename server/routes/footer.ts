import { Router } from "express";
import { storage } from "../storage";
import { requireAuth, requireAdmin } from "../auth";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { logger } from "../utils/logger";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { ok, error } from "../apiResponse";

export const footerRouter = Router();
const upload = multer({ dest: "uploads/" });

const socialLinkSchema = z.object({
  id: z.string(),
  platform: z.string(),
  url: z.string().url(),
  icon: z.string(),
});

const footerContentSchema = z.object({
  companyName: z.string().min(1).max(100),
  tagline: z.string().max(500).default(""),
  address: z.string().max(300).default(""),
  phone: z.string().max(20).default(""),
  email: z.string().email().default(""),
  socialLinks: z.array(socialLinkSchema).default([]),
  copyright: z.string().default(""),
  logoUrl: z.string().optional(),
});

// Default footer content
const defaultFooterContent = {
  companyName: "Dapur Dekaka",
  tagline: "Premium halal dim sum made with love and quality ingredients.",
  address: "Jl. Sinom V No.7, Turangga, Kec. Lengkong, Kota Bandung, Jawa Barat 40264",
  phone: "082295986407",
  email: "contact@dapurdekaka.com",
  socialLinks: [
    {
      id: "1",
      platform: "Instagram",
      url: "https://instagram.com/dapurdekaka",
      icon: "Instagram"
    },
    {
      id: "2",
      platform: "Shopee",
      url: "https://shopee.co.id/dapurdekaka",
      icon: "Shopee"
    },
    {
      id: "3",
      platform: "WhatsApp",
      url: "https://wa.me/6282295986407",
      icon: "WhatsApp"
    },
    {
      id: "4",
      platform: "Grab",
      url: "https://food.grab.com/id/en/restaurant/dapur-dekaka-dimsum-delivery/",
      icon: "Grab"
    }
  ],
  copyright: `© ${new Date().getFullYear()} Dapur Dekaka. All rights reserved.`,
  logoUrl: ""
};

// Ensure directories exist
async function ensureDirectories() {
  const dirs = ['uploads', 'public/footer'];
  for (const dir of dirs) {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }
}

// GET footer content
footerRouter.get("/api/pages/footer", async (_req, res) => {
  try {
    logger.debug("Fetching footer content");
    const pageContent = await storage.getPageContent("footer");

    if (pageContent && pageContent.content) {
      return res.status(200).json(ok(pageContent));
    }

    // Return default footer content without writing to DB
    res.status(200).json(ok({ content: defaultFooterContent }));
  } catch (err) {
    logger.error("Error fetching footer content", { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json(error("FETCH_FAILED", "Failed to fetch footer content", 500));
  }
});

// UPDATE footer content
footerRouter.put("/api/pages/footer", requireAuth, requireAdmin, upload.single("logo"), async (req, res) => {
  try {
    await ensureDirectories();
    logger.debug("Updating footer content");

    let footerData = req.body;

    // Handle JSON string in body
    if (typeof footerData === "string") {
      try {
        footerData = JSON.parse(footerData);
      } catch (err) {
        logger.error("Error parsing footer data", { error: err instanceof Error ? err.message : String(err) });
        return res.status(400).json(error("PARSE_ERROR", "Invalid footer data format", 400));
      }
    }

    // Validate footer content
    const validation = footerContentSchema.safeParse(footerData);
    if (!validation.success) {
      return res.status(400).json(error("VALIDATION_FAILED", fromZodError(validation.error).message, 400));
    }

    // Process logo upload if provided
    if (req.file) {
      const file = req.file;
      const fileExt = path.extname(file.originalname);
      const fileName = `footer-logo${fileExt}`;
      const destPath = path.join("public/footer", fileName);

      // Save the uploaded file
      await fs.rename(file.path, destPath);

      // Update logo URL in footer data
      validation.data.logoUrl = `/footer/${fileName}?t=${Date.now()}`;
    }

    // Update footer content in database
    await storage.updatePageContent("footer", { content: validation.data });

    res.status(200).json(ok({ message: "Footer content updated successfully" }));
  } catch (err) {
    logger.error("Error updating footer content", { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json(error("UPDATE_FAILED", "Failed to update footer content", 500));
  }
});

export default footerRouter;