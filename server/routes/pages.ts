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
  res.set('Surrogate-Control', 'no-store');
  res.set('ETag', Date.now().toString()); // Force new ETag on every request
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
      // Update both hero and carousel settings with the same values for consistency
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

      // Also update the direct carousel properties for backward compatibility
      if (homepageConfig.carousel) {
        homepageConfig.carousel.title = content.carousel?.title || homepageConfig.carousel.title;
        homepageConfig.carousel.subtitle = content.carousel?.subtitle || homepageConfig.carousel.subtitle;
      }
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

    try {
      // Save the updated config to the database
      await storage.updatePageContent('homepage', {content: homepageConfig});

      // Send back updated homepage
      console.log('[PUT] Updated homepage configuration', homepageConfig);

      // Add a successful response
      res.json({ success: true, message: "Homepage updated successfully" });
    } catch (error) {
      console.error('[PUT] Error updating homepage configuration:', error);
      res.status(500).json({ success: false, message: "Failed to update homepage" });
    }
    // res.json(homepageConfig); //Removed to fix ERR_HTTP_HEADERS_SENT
  } catch (error) {
    console.error('[PUT] Error processing files:', error);
    res.status(500).json({ message: "Internal server error" });
  }
});

pagesRouter.put("/homepage/carousel/reorder", async (req, res) => {
  try {
    const { images } = req.body;
    if (!Array.isArray(images)) {
      return res.status(400).json({ message: "Invalid image array provided" });
    }

    homepageConfig.carousel.images = images;
    try {
      await storage.updatePageContent('homepage', {content: homepageConfig}); //Save to database after reorder
      res.json({ success: true, message: "Image order updated successfully" });
    } catch (saveError) {
      console.error("Error saving reordered images:", saveError);
      res.status(500).json({ success: false, message: "Failed to save image order" });
    }
  } catch (error) {
    console.error("Error reordering images:", error);
    res.status(400).json({ success: false, message: "Failed to reorder images" });
    res.status(500).json({ message: "Failed to reorder images" });
  }
});


// Load homepage config from database on startup
(async function loadHomepageConfig() {
  try {
    console.log("Loading homepage configuration from database...");
    const storedConfig = await storage.getPageContent('homepage');
    if (storedConfig && storedConfig.content) {
      homepageConfig = storedConfig.content;
      console.log("Homepage configuration loaded from database");
    } else {
      console.log("No stored homepage configuration found, using default");
    }
  } catch (error) {
    console.error("Error loading homepage config from database:", error);
    console.log("Using default homepage configuration");
  }
})();

// Clear cache when server receives SIGTERM or other signals
process.on('SIGTERM', () => {
  console.log('Clearing homepage cache before shutdown');
  homepageConfig = null; //This should ideally clear the cache more robustly depending on your caching mechanism.
});

process.on('SIGINT', () => {
  console.log('Clearing homepage cache before shutdown');
  homepageConfig = null; //This should ideally clear the cache more robustly depending on your caching mechanism.
});

export default pagesRouter;