import express from "express";
import { storage } from "../storage";
import { pageContentSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { requireAuth } from "../auth";
import cors from "cors";
import { upload } from "../storage";
import * as fs from 'fs/promises';
import path from "path";

const router = express.Router();

// Ensure directories exist
async function ensureDirectories() {
  const assetDir = path.join(process.cwd(), 'public', 'asset');
  const contactDir = path.join(process.cwd(), 'public', 'asset', 'contact');
  
  try {
    await fs.mkdir(assetDir, { recursive: true });
    await fs.mkdir(contactDir, { recursive: true });
    console.log("Contact directories created/verified successfully");
  } catch (error) {
    console.error("Error creating contact directories:", error);
    throw error;
  }
}

// Handle contact form submissions from users
router.post("/api/contact", async (req, res) => {
  try {
    const { name, email, phone, subject, message, timestamp } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !subject || !message) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Here you can add alternative contact form handling logic if needed
    // For now just return success
    res.status(200).json({ message: "Form submitted successfully" });
  } catch (error) {
    console.error("Error submitting form:", error);
    res.status(500).json({ error: "Failed to submit form" });
  }
});

// Get contact page content
router.get("/api/pages/contact", cors(), async (req, res) => {
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

    // Add a timestamp parameter to force image refresh
    const timestamp = Date.now();
    if (pageContent && pageContent.content) {
      const contactContent = pageContent.content as {
        title: string;
        description: string;
        mainImage: string;
        contactInfo: {
          address: string;
          phone: string;
          email: string;
          openingHours: string;
          mapEmbedUrl: string;
        };
        socialLinks: {
          id: string;
          label: string;
          url: string;
          icon: string;
        }[];
        quickOrderUrl: string;
      };
      
      // Add timestamp to main image
      if (contactContent.mainImage) {
        const imageUrl = contactContent.mainImage;
        contactContent.mainImage = imageUrl.includes('?') 
          ? imageUrl
          : `${imageUrl}?t=${timestamp}`;
      }
      
      // Update the pageContent
      pageContent.content = contactContent;
    }

    res.json(pageContent || defaultContent);
  } catch (error) {
    console.error("Error fetching contact page:", error);
    res.status(500).json({ error: "Failed to fetch contact page content" });
  }
});

// Update contact page content
router.put("/api/pages/contact", requireAuth, async (req, res) => {
  try {
    const validation = pageContentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: fromZodError(validation.error).message
      });
    }

    const updatedContent = await storage.updatePageContent("contact", validation.data);
    res.json(updatedContent);
  } catch (error) {
    console.error("Error updating contact page:", error);
    res.status(500).json({
      error: "Failed to update contact page content",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Handle file uploads for the contact page
router.post("/api/pages/contact/upload", requireAuth, upload.fields([
  { name: 'mainImage', maxCount: 1 }
]), async (req, res) => {
  try {
    await ensureDirectories();
    console.log('[POST] Contact page received files:', req.files);
    
    let contentObj;
    try {
      contentObj = req.body.content ? JSON.parse(req.body.content) : null;
      console.log('[POST] Contact page received content:', contentObj);
    } catch (parseError) {
      console.error('[POST] Error parsing content:', parseError);
      return res.status(400).json({ message: "Invalid content format" });
    }
    
    if (!contentObj) {
      return res.status(400).json({ message: "Missing content data" });
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
        
        console.log(`[POST] Moved contact main image to ${newPath}`);
      } catch (error) {
        console.error('[POST] Error processing main image:', error);
        return res.status(500).json({ message: "Error processing main image" });
      }
    }
    
    // Save updated content to database
    const updatedContent = await storage.updatePageContent("contact", { content: contentObj });
    
    res.json({ 
      success: true, 
      message: "Contact page updated successfully with file uploads", 
      content: updatedContent 
    });
  } catch (error) {
    console.error('[POST] Error handling contact page file uploads:', error);
    res.status(500).json({
      error: "Failed to process file uploads",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export default router;