
import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";

const pagesRouter = Router();
const upload = multer({ dest: "uploads/" });

// Mock data structure - replace with database in production
const pageContents: Record<string, any> = {
  about: {
    title: "About Us",
    content: {
      mainHeading: "About Dapur Dekaka",
      description: "Dapur Dekaka adalah produsen frozen food dimsum berbagai varian...",
      features: "Di Dapur Dekaka, kami sangat bersemangat untuk menghadirkan cita rasa otentik..."
    },
    images: {
      mainImage: "/asset/28.jpg",
      featureImages: ["/asset/13.jpg", "/asset/21.jpg"]
    }
  },
  contact: {
    title: "Contact Us",
    content: {
      mainHeading: "Get in Touch",
      contactInfo: "Contact information goes here..."
    },
    images: {
      contactImage: "/asset/contact.jpg"
    }
  }
};

pagesRouter.get("/:pageId", async (req, res) => {
  const { pageId } = req.params;
  const pageContent = pageContents[pageId];
  
  if (!pageContent) {
    return res.status(404).json({ message: "Page not found" });
  }
  
  res.json(pageContent);
});

pagesRouter.put("/:pageId", upload.array("images"), async (req, res) => {
  const { pageId } = req.params;
  const { content } = req.body;
  
  try {
    pageContents[pageId] = {
      ...pageContents[pageId],
      content: JSON.parse(content)
    };
    
    // Handle image uploads if any
    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files) {
        const newPath = path.join("uploads", file.filename + path.extname(file.originalname));
        await fs.rename(file.path, newPath);
        // Update image paths in content
      }
    }
    
    res.json(pageContents[pageId]);
  } catch (error) {
    res.status(500).json({ message: "Failed to update page content" });
  }
});

export default pagesRouter;
