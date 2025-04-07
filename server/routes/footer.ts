import { Router } from "express";
import { storage } from "../storage";
import { requireAuth } from "../auth";
import multer from "multer";
import path from "path";
import fs from "fs/promises";

export const footerRouter = Router();
const upload = multer({ dest: "uploads/" });

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
      console.log(`[Directory Check] ${dir} exists`);
    } catch {
      await fs.mkdir(dir, { recursive: true });
      console.log(`[Directory Check] Created ${dir}`);
    }
  }
}

// GET footer content
footerRouter.get("/api/pages/footer", async (req, res) => {
  try {
    console.log("Fetching footer content");
    const pageContent = await storage.getPageContent("footer");
    
    if (pageContent && pageContent.content) {
      return res.json({ content: pageContent.content });
    }
    
    // Create default footer content if none exists
    const newFooterContent = await storage.updatePageContent("footer", { 
      content: defaultFooterContent 
    });
    
    res.json({ content: newFooterContent.content });
  } catch (error) {
    console.error("Error fetching footer content:", error);
    res.status(500).json({ message: "Failed to fetch footer content" });
  }
});

// UPDATE footer content
footerRouter.put("/api/pages/footer", requireAuth, upload.single("logo"), async (req, res) => {
  try {
    await ensureDirectories();
    console.log("Updating footer content");
    
    let footerData = req.body;
    
    // Handle JSON string in body
    if (typeof footerData === "string") {
      try {
        footerData = JSON.parse(footerData);
      } catch (error) {
        console.error("Error parsing footer data:", error);
        return res.status(400).json({ message: "Invalid footer data format" });
      }
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
      footerData.logoUrl = `/footer/${fileName}?t=${Date.now()}`;
    }
    
    // Update footer content in database
    await storage.updatePageContent("footer", { content: footerData });
    
    res.json({ message: "Footer content updated successfully" });
  } catch (error) {
    console.error("Error updating footer content:", error);
    res.status(500).json({ message: "Failed to update footer content" });
  }
});

export default footerRouter;