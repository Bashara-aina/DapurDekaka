import express from "express";
import { storage } from "../storage";
import { pageContentSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { requireAuth } from "../auth";
import cors from "cors";
import { upload } from "../storage";
import * as fs from 'fs/promises';
import path from "path";
import { logger } from "../utils/logger";
import { z } from "zod";
import { ok, created, error } from "../apiResponse";

const router = express.Router();

const contactSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  message: z.string().min(1).max(2000),
  phone: z.string().optional(),
  subject: z.string().optional(),
});

// Ensure directories exist
async function ensureDirectories() {
  const assetDir = path.join(process.cwd(), 'public', 'asset');
  const contactDir = path.join(process.cwd(), 'public', 'asset', 'contact');

  try {
    await fs.mkdir(assetDir, { recursive: true });
    await fs.mkdir(contactDir, { recursive: true });
  } catch (err) {
    logger.error("Error creating contact directories", { error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

// Handle contact form submissions from users
router.post("/api/contact", async (req, res) => {
  try {
    const validation = contactSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json(error("VALIDATION_FAILED", fromZodError(validation.error).message, 400));
    }

    const { name, email, message, phone } = validation.data;

    logger.debug("Contact form submission", { name, email });
    res.status(200).json(ok({ message: "Thank you for your message. We will get back to you soon." }));
  } catch (err) {
    logger.error("Error submitting contact form", { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json(error("SERVER_ERROR", "Failed to submit form", 500));
  }
});

// Get contact page content
router.get("/api/pages/contact", cors(), async (_req, res) => {
  try {
    const pageContent = await storage.getPageContent("contact");
    const defaultContent = {
      content: {
        title: "Contact Us",
        description: "Get in touch with us for any inquiries about our premium halal dim sum. We'd love to hear from you!",
        mainImage: "/asset/1.jpg",
        contactInfo: {
          address: "Jl. Sinom V No.7, Turangga, Kec. Lengkong, Kota Bandung, Jawa Barat 40264",
          phone: "+62 8229-5986-407",
          email: "dapurdekaka@gmail.com",
          openingHours: "07:30 - 20:00",
          mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3960.628663657452!2d107.62787277454113!3d-6.934907867883335!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e68e98f06fbfe3f%3A0xd60d9e2dbd74a207!2sDapur%20Dekaka!5e0!3m2!1sid!2sid!4v1739461694952!5m2!1sid!2sid"
        },
        socialLinks: [
          {
            id: "shopee",
            label: "Shopee",
            url: "https://shopee.co.id/dapurdekaka",
            icon: "simple-icons:shopee"
          },
          {
            id: "instagram",
            label: "Instagram",
            url: "https://instagram.com/dapurdekaka",
            icon: "lucide:instagram"
          },
          {
            id: "grab",
            label: "Grab",
            url: "https://mart.grab.com/id/id/merchant/6-C62BTTXXSB33TE",
            icon: "simple-icons:grab"
          }
        ],
        quickOrderUrl: "https://wa.me/6282295986407"
      }
    };

    res.status(200).json(ok(pageContent || defaultContent));
  } catch (err) {
    logger.error("Error fetching contact page", { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json(error("FETCH_FAILED", "Failed to fetch contact page content", 500));
  }
});

// Update contact page content
router.put("/api/pages/contact", requireAuth, async (req, res) => {
  try {
    const validation = pageContentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json(error("VALIDATION_FAILED", fromZodError(validation.error).message, 400));
    }

    const updatedContent = await storage.updatePageContent("contact", validation.data);
    res.status(200).json(ok(updatedContent));
  } catch (err) {
    logger.error("Error updating contact page", { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json(error("UPDATE_FAILED", "Failed to update contact page content", 500));
  }
});

// Handle file uploads for the contact page
router.post("/api/pages/contact/upload", requireAuth, upload.fields([
  { name: 'mainImage', maxCount: 1 }
]), async (req, res) => {
  try {
    await ensureDirectories();
    logger.debug('[POST] Contact page received files');

    let contentObj;
    try {
      contentObj = req.body.content ? JSON.parse(req.body.content) : null;
    } catch (parseError) {
      logger.error('[POST] Error parsing contact page content', { error: parseError instanceof Error ? parseError.message : String(parseError) });
      return res.status(400).json(error("PARSE_ERROR", "Invalid content format", 400));
    }

    if (!contentObj) {
      return res.status(400).json(error("VALIDATION_ERROR", "Missing content data", 400));
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    // Process main image if provided
    if (files.mainImage && files.mainImage.length > 0) {
      try {
        const mainImageFile = files.mainImage[0];
        const ext = path.extname(mainImageFile.originalname);
        const mainImageFilename = `contact-main${ext}`;
        const newPath = path.join(process.cwd(), 'public', 'asset', 'contact', mainImageFilename);

        // Move file from temp upload location to final destination
        await fs.rename(mainImageFile.path, newPath);

        // Update the content object with new image path
        contentObj.mainImage = `/asset/contact/${mainImageFilename}`;
      } catch (err) {
        logger.error('[POST] Error processing main image', { error: err instanceof Error ? err.message : String(err) });
        return res.status(500).json(error("UPLOAD_FAILED", "Error processing main image", 500));
      }
    }

    // Save updated content to database
    const updatedContent = await storage.updatePageContent("contact", { content: contentObj });

    res.status(200).json(ok({ message: "Contact page updated successfully", content: updatedContent }));
  } catch (err) {
    logger.error('[POST] Error handling contact page file uploads', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json(error("SERVER_ERROR", "Failed to process file uploads", 500));
  }
});

export default router;