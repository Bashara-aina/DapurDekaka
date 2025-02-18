import { Router } from "express";
import multer from "multer";
import { storage } from "../storage";
import path from "path";
import fs from "fs/promises";

export const pagesRouter = Router();
const upload = multer({ dest: "uploads/" });

const defaultHomepage = {
  carousel: {
    images: Array.from({length: 33}, (_, i) => `/asset/${i + 1}.jpg`)
  },
  logo: "/logo/logo.png",
  content: {
    hero: {
      title: "Dapur Dekaka",
      subtitle: "Authentic Halal Dim Sum",
      description: "Experience the finest halal dim sum in town"
    },
    featuredProducts: {
      title: "Featured Products",
      subtitle: "Discover our most loved dim sum selections"
    },
    latestArticles: {
      title: "Latest Articles",
      subtitle: "Discover our latest news and updates"
    }
  }
};

let homepageConfig = {...defaultHomepage};

// Ensure directories exist
async function ensureDirectories() {
  const dirs = ['public/logo', 'public/asset', 'uploads'];
  for (const dir of dirs) {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }
}

pagesRouter.get("/homepage", (req, res) => {
  // Add cache control headers to prevent browser caching
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.json(homepageConfig);
});

pagesRouter.put("/homepage", upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'carouselImages', maxCount: 33 }
]), async (req, res) => {
  try {
    await ensureDirectories();

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const content = req.body.content ? JSON.parse(req.body.content) : homepageConfig.content;
    console.log('Received content update:', content); // Add logging

    if (files.logo) {
      const logo = files.logo[0];
      const ext = path.extname(logo.originalname);
      const newPath = path.join(process.cwd(), 'public', 'logo', `logo${ext}`);
      await fs.rename(logo.path, newPath);
      homepageConfig.logo = `/logo/logo${ext}`;
    }

    if (files.carouselImages) {
      const newImages = await Promise.all(files.carouselImages.map(async (file, i) => {
        const ext = path.extname(file.originalname);
        const newPath = path.join(process.cwd(), 'public', 'asset', `${i + 1}${ext}`);
        await fs.rename(logo.path, newPath);
        return `/asset/${i + 1}${ext}`;
      }));

      if (newImages.length > 0) {
        homepageConfig.carousel.images = newImages;
      }
    }

    // Update content with deep merge to ensure all fields are updated
    if (content) {
      homepageConfig.content = {
        hero: {
          ...homepageConfig.content.hero,
          ...content.hero
        },
        featuredProducts: {
          ...homepageConfig.content.featuredProducts,
          ...content.featuredProducts
        },
        latestArticles: {
          ...homepageConfig.content.latestArticles,
          ...content.latestArticles
        }
      };
    }

    console.log('Updated homepage config:', homepageConfig); // Add logging
    res.json(homepageConfig);
  } catch (error) {
    console.error("Error updating homepage:", error);
    res.status(500).json({ message: "Failed to update homepage" });
  }
});

// New endpoint to handle carousel image reordering
pagesRouter.put("/homepage/carousel/reorder", async (req, res) => {
  try {
    const { images } = req.body;
    if (!Array.isArray(images)) {
      return res.status(400).json({ message: "Invalid image array provided" });
    }

    homepageConfig.carousel.images = images;
    res.json({ message: "Image order updated successfully" });
  } catch (error) {
    console.error("Error reordering images:", error);
    res.status(500).json({ message: "Failed to reorder images" });
  }
});

pagesRouter.delete("/homepage/carousel/:index", async (req, res) => {
  try {
    const index = parseInt(req.params.index);
    if (isNaN(index) || index < 0 || index >= homepageConfig.carousel.images.length) {
      return res.status(400).json({ message: "Invalid image index" });
    }

    const imagePath = homepageConfig.carousel.images[index];
    const fullPath = path.join(process.cwd(), 'public', imagePath);

    try {
      await fs.unlink(fullPath);
    } catch (error) {
      console.warn("Could not delete file:", error);
    }

    homepageConfig.carousel.images.splice(index, 1);
    res.json({ message: "Image deleted successfully" });
  } catch (error) {
    console.error("Error deleting image:", error);
    res.status(500).json({ message: "Failed to delete image" });
  }
});

export default pagesRouter;