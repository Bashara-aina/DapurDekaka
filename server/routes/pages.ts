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
      subtitle: "Nikmati Sensasi Dimsum Premium dengan Cita Rasa Autentik!"
    },
    carousel: {
      title: "Dapur Dekaka",
      subtitle: "Nikmati Sensasi Dimsum Premium dengan Cita Rasa Autentik!"
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
      console.log(`[Directory Check] ${dir} exists`);
    } catch {
      await fs.mkdir(dir, { recursive: true });
      console.log(`[Directory Check] Created ${dir}`);
    }
  }
}

// Add strict no-cache headers and debug logging
const setNoCacheHeaders = (res: any) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
};

pagesRouter.get("/homepage", async (req, res) => {
  setNoCacheHeaders(res);
  console.log('[GET] Sending homepage data:', homepageConfig);
  res.json({
    ...homepageConfig,
    timestamp: Date.now()
  });
});

pagesRouter.put("/homepage", upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'carouselImages', maxCount: 33 }
]), async (req, res) => {
  try {
    await ensureDirectories();
    setNoCacheHeaders(res);
    console.log('[PUT] Received files:', req.files);

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    let content;

    try {
      content = req.body.content ? JSON.parse(req.body.content) : null;
      console.log('[PUT] Received content update:', content);
    } catch (parseError) {
      console.error('[PUT] Error parsing content:', parseError);
      return res.status(400).json({ message: "Invalid content format" });
    }

    if (content) {
      homepageConfig.content = {
        ...homepageConfig.content,
        hero: {
          title: content.carousel?.title || homepageConfig.content.hero.title,
          subtitle: content.carousel?.subtitle || homepageConfig.content.hero.subtitle
        },
        carousel: {
          title: content.carousel?.title || homepageConfig.content.carousel.title,
          subtitle: content.carousel?.subtitle || homepageConfig.content.carousel.subtitle
        },
        featuredProducts: homepageConfig.content.featuredProducts,
        latestArticles: homepageConfig.content.latestArticles
      };
    }

    if (files.logo && files.logo[0]) {
      const logo = files.logo[0];
      console.log('[PUT] Processing logo file:', logo);

      // Get the original file extension, defaulting to .png if none
      const ext = path.extname(logo.originalname).toLowerCase() || '.png';
      const logoFileName = `logo${ext}`;
      const logoDir = path.join(process.cwd(), 'public', 'logo');
      const newPath = path.join(logoDir, logoFileName);

      console.log('[PUT] Logo processing details:', {
        originalName: logo.originalname,
        tempPath: logo.path,
        targetDir: logoDir,
        targetPath: newPath,
        extension: ext
      });

      // Ensure logo directory exists
      await fs.mkdir(logoDir, { recursive: true });

      // Remove old logo if exists
      try {
        const oldLogoPath = path.join(process.cwd(), 'public', homepageConfig.logo.replace(/^\//, ''));
        await fs.unlink(oldLogoPath);
        console.log('[PUT] Removed old logo:', oldLogoPath);
      } catch (error) {
        console.warn('[PUT] Could not delete old logo:', error);
      }

      // Move new logo
      await fs.rename(logo.path, newPath);
      homepageConfig.logo = `/logo/${logoFileName}`;
      console.log('[PUT] Updated logo path:', homepageConfig.logo);

      // Verify file exists after move
      try {
        await fs.access(newPath);
        console.log('[PUT] Verified new logo exists at:', newPath);
      } catch (error) {
        console.error('[PUT] Error: New logo file not found after move:', error);
        return res.status(500).json({ message: "Failed to save logo file" });
      }
    }

    if (files.carouselImages) {
      const newImages = await Promise.all(files.carouselImages.map(async (file, i) => {
        const ext = path.extname(file.originalname);
        const newPath = path.join(process.cwd(), 'public', 'asset', `${i + 1}${ext}`);
        await fs.rename(file.path, newPath);
        return `/asset/${i + 1}${ext}`;
      }));

      if (newImages.length > 0) {
        homepageConfig.carousel.images = newImages;
      }
    }

    console.log('[PUT] Final homepage config:', homepageConfig);
    res.json({
      ...homepageConfig,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error("[PUT] Error updating homepage:", error);
    res.status(500).json({ message: "Failed to update homepage" });
  }
});

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

export default pagesRouter;