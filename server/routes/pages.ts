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
        await fs.rename(file.path, newPath);
        return `/asset/${i + 1}${ext}`;
      }));

      // Only update carousel images if new ones are uploaded
      if (newImages.length > 0) {
        homepageConfig.carousel.images = newImages;
      }
    }

    // Update content if provided
    if (content) {
      homepageConfig.content = content;
    }

    res.json(homepageConfig);
  } catch (error) {
    console.error("Error updating homepage:", error);
    res.status(500).json({ message: "Failed to update homepage" });
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