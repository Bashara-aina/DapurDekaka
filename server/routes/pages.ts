
import { Router } from "express";
import multer from "multer";
import { storage } from "../storage";
import path from "path";
import fs from "fs/promises";

const pagesRouter = Router();
const upload = multer({ dest: "uploads/" });

const defaultHomepage = {
  carousel: {
    images: Array.from({length: 33}, (_, i) => `/asset/${i + 1}.jpg`)
  },
  logo: "/logo/logo.png",
  content: {
    hero: {
      title: "Dapur Dekaka",
      subtitle: "Authentic Halal Dim Sum"
    }
  }
};

let homepageConfig = {...defaultHomepage};

pagesRouter.get("/homepage", (req, res) => {
  res.json(homepageConfig);
});

pagesRouter.put("/homepage", upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'carouselImages', maxCount: 33 }
]), async (req, res) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const content = req.body.content ? JSON.parse(req.body.content) : homepageConfig.content;

    if (files.logo) {
      const logo = files.logo[0];
      const ext = path.extname(logo.originalname);
      const newPath = `/logo/logo${ext}`;
      await fs.rename(logo.path, `public${newPath}`);
      homepageConfig.logo = newPath;
    }

    if (files.carouselImages) {
      const newImages = await Promise.all(files.carouselImages.map(async (file, i) => {
        const ext = path.extname(file.originalname);
        const newPath = `/asset/${i + 1}${ext}`;
        await fs.rename(file.path, `public${newPath}`);
        return newPath;
      }));
      homepageConfig.carousel.images = newImages;
    }

    homepageConfig.content = content;
    res.json(homepageConfig);
  } catch (error) {
    res.status(500).json({ message: "Failed to update homepage" });
  }
});

export default pagesRouter;
