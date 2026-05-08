import { Router, Response } from "express";
import multer from "multer";
import { storage } from "../storage";
import { requireAuth, requireAdmin } from "../auth";
import path from "path";
import fs from "fs/promises";
import { z } from "zod";
import { ok, created, error } from "../apiResponse";
import { fromZodError } from "zod-validation-error";
import { logger } from "../utils/logger";

export const pagesRouter = Router();

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Received ${file.mimetype}. Only JPEG, PNG, WebP and GIF are allowed.`));
    }
  }
});

const homepageContentSchema = z.object({
  hero: z.object({
    title: z.string(),
    subtitle: z.string(),
  }).optional(),
  carousel: z.object({
    title: z.string(),
    subtitle: z.string(),
  }).optional(),
  featuredProducts: z.object({
    title: z.string(),
    subtitle: z.string(),
  }).optional(),
  latestArticles: z.object({
    title: z.string(),
    subtitle: z.string(),
  }).optional(),
  customers: z.object({
    title: z.string(),
    subtitle: z.string(),
    logos: z.array(z.string()),
    testimonials: z.array(z.object({
      id: z.string(),
      name: z.string(),
      quote: z.string(),
    })).optional().default([]),
  }).optional(),
});

type HomepageCustomers = {
  title: string;
  subtitle: string;
  logos: string[];
  testimonials?: never;
};

type HomepageConfig = {
  carousel: {
    images: string[];
    title: string;
    subtitle: string;
  };
  logo: string;
  content: {
    hero: { title: string; subtitle: string };
    carousel: { title: string; subtitle: string };
    featuredProducts: { title: string; subtitle: string };
    latestArticles: { title: string; subtitle: string };
    customers: HomepageCustomers;
  };
};

const defaultHomepageConfig: HomepageConfig = {
  carousel: {
    images: Array.from({length: 33}, (_, i) => `/asset/${i + 1}.jpg`),
    title: "Dapur Dekaka",
    subtitle: "Nikmati Sensasi Dimsum Premium dengan Cita Rasa Autentik!"
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
    },
    customers: {
      title: "Our Customers",
      subtitle: "Trusted by businesses across Indonesia",
      logos: ["/logo/logo.png", "/logo/halal.png", "/logo/logo.png", "/logo/halal.png"]
    }
  }
};

let homepageConfig: HomepageConfig = { ...defaultHomepageConfig };

// Ensure directories exist
async function ensureDirectories() {
  const dirs = ['public/logo', 'public/asset', 'uploads', 'public/logo/customers'];
  for (const dir of dirs) {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }
}

// Cache-control helpers for public and admin routes
const setPublicCacheHeaders = (res: Response) => {
  // Allow Vercel's edge cache and browsers to reuse homepage data briefly,
  // while still revalidating in the background to keep it fresh.
  res.set("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=86400");
};

const setNoCacheHeaders = (res: Response) => {
  // Used on admin mutation routes so editors always see fresh data.
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.set("Surrogate-Control", "no-store");
};

pagesRouter.get("/homepage", async (_req, res) => {
  // Allow public homepage config to be cached at the edge to reduce Fast Origin Transfer usage
  setPublicCacheHeaders(res);

  // Fetch fresh from DB each time
  let homepageData: HomepageConfig = { ...defaultHomepageConfig };
  try {
    const storedConfig = await storage.getPageContent('homepage');
    if (storedConfig && storedConfig.content) {
      homepageData = storedConfig.content as HomepageConfig;

      // Initialize customers section if it doesn't exist
      if (!homepageData.content.customers) {
        homepageData.content.customers = {
          title: "Our Customers",
          subtitle: "Trusted by businesses across Indonesia",
          logos: []
        };
      }

      // Ensure logos array exists
      if (!homepageData.content.customers.logos) {
        homepageData.content.customers.logos = [];
      }

      // Add default logos if none exist
      if (homepageData.content.customers.logos.length === 0) {
        homepageData.content.customers.logos = [
          '/logo/halal.png',
          '/logo/logo.png'
        ];
      }
    }
  } catch (err) {
    console.error("Error fetching homepage from DB:", err);
    // Use default on error
  }

  res.status(200).json(ok(homepageData));
});

// Add handler for customer logo uploads and processing
pagesRouter.put("/homepage/customers", requireAuth, requireAdmin, upload.fields([
  { name: 'customerLogos', maxCount: 10 }
]), async (req, res) => {
  try {
    await ensureDirectories();
    setNoCacheHeaders(res);
    logger.debug('[PUT] Received customer files');
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    let content;

    try {
      content = req.body.content ? JSON.parse(req.body.content) : null;
    } catch (parseError) {
      logger.error('[PUT] Error parsing customers content', { error: parseError instanceof Error ? parseError.message : String(parseError) });
      return res.status(400).json(error("PARSE_ERROR", "Invalid content format", 400));
    }

    // Validate content if provided
    if (content) {
      const validation = homepageContentSchema.safeParse({ customers: content.customers });
      if (!validation.success) {
        return res.status(400).json(error("VALIDATION_FAILED", "Invalid customers content", 400));
      }
    }

    // Update customers section content
    if (content && content.customers) {
      // Initialize customers section if it doesn't exist
      if (!homepageConfig.content.customers) {
        homepageConfig.content.customers = {
          title: "Our Customers",
          subtitle: "Trusted by businesses across Indonesia",
          logos: [] as string[],
        };
      }

      // Update the title and subtitle
      homepageConfig.content.customers.title = content.customers.title || homepageConfig.content.customers.title;
      homepageConfig.content.customers.subtitle = content.customers.subtitle || homepageConfig.content.customers.subtitle;

      // Ensure we have a logos array
      if (!homepageConfig.content.customers.logos) {
        homepageConfig.content.customers.logos = [];
      }
    }

    // Process logo files if any were uploaded
    if (files.customerLogos && files.customerLogos.length > 0) {
      const customerLogosDir = path.join(process.cwd(), 'public', 'logo', 'customers');

      // Ensure directory exists
      try {
        await fs.mkdir(customerLogosDir, { recursive: true });
      } catch (err) {
        logger.error('[PUT] Error creating customer logos directory', { error: err instanceof Error ? err.message : String(err) });
        const message = err instanceof Error ? err.message : "Unknown error";
        return res.status(500).json(error("DIRECTORY_ERROR", `Failed to create customer logos directory: ${message}`, 500));
      }

      // Process each logo file
      const newLogos = await Promise.all(files.customerLogos.map(async (file, i) => {
        const timestamp = Date.now();
        const ext = path.extname(file.originalname) || '.png';
        const filename = `customer-logo-${timestamp}-${i}${ext}`;
        const newPath = path.join(customerLogosDir, filename);

        // Copy the file
        await fs.copyFile(file.path, newPath);

        // Clean up temp file
        await fs.unlink(file.path);

        return `/logo/customers/${filename}`;
      }));

      // Add new logos to the existing ones
      homepageConfig.content.customers.logos = [
        ...homepageConfig.content.customers.logos,
        ...newLogos
      ];
    }

    // Save the updated config to the database
    await storage.updatePageContent('homepage', { content: homepageConfig });

    // Send success response
    res.status(200).json(ok({ message: "Customers section updated successfully", data: homepageConfig.content.customers }));
  } catch (err) {
    logger.error('[PUT] Error updating customers section', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json(error("SERVER_ERROR", "Internal server error", 500));
  }
});

// Reorder customer logos
pagesRouter.put("/homepage/customers/logos/reorder", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { logos } = req.body;
    if (!Array.isArray(logos)) {
      return res.status(400).json(error("VALIDATION_ERROR", "Invalid logos array provided", 400));
    }

    // Make sure we have a customers section
    if (!homepageConfig.content.customers) {
      homepageConfig.content.customers = {
        title: "Our Customers",
        subtitle: "Trusted by businesses across Indonesia",
        logos: []
      };
    }

    // Update the logos array
    homepageConfig.content.customers.logos = logos;

    // Save to database
    await storage.updatePageContent('homepage', { content: homepageConfig });

    res.status(200).json(ok({ message: "Customer logos reordered successfully" }));
  } catch (err) {
    logger.error("Error reordering customer logos", { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json(error("REORDER_FAILED", "Failed to reorder customer logos", 500));
  }
});

// Delete a customer logo
pagesRouter.delete('/homepage/customers/logos/:index', requireAuth, requireAdmin, async (req, res) => {
  try {
    const index = parseInt(req.params.index, 10);
    if (isNaN(index) || index < 0) {
      return res.status(400).json(error("INVALID_INDEX", "Invalid logo index", 400));
    }

    // Check if customers section and logos array exist
    if (!homepageConfig.content.customers ||
        !homepageConfig.content.customers.logos ||
        index >= homepageConfig.content.customers.logos.length) {
      return res.status(404).json(error("NOT_FOUND", "Customer logo not found", 404));
    }

    // Remove the logo from the array
    homepageConfig.content.customers.logos.splice(index, 1);

    // Save the updated config
    await storage.updatePageContent('homepage', { content: homepageConfig });

    res.status(200).json(ok({ message: "Customer logo deleted successfully" }));
  } catch (err) {
    logger.error("Error deleting customer logo", { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json(error("DELETE_FAILED", "Failed to delete customer logo", 500));
  }
});

pagesRouter.put("/homepage", requireAuth, requireAdmin, upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'carouselImages', maxCount: 33 },
  { name: 'customerLogos', maxCount: 10 }
]), async (req, res) => {
  try {
    await ensureDirectories();
    setNoCacheHeaders(res);
    logger.debug('[PUT] Received files');
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    let content;

    try {
      content = req.body.content ? JSON.parse(req.body.content) : null;
    } catch (parseError) {
      logger.error('[PUT] Error parsing content', { error: parseError instanceof Error ? parseError.message : String(parseError) });
      return res.status(400).json(error("PARSE_ERROR", "Invalid content format", 400));
    }

    // Validate content if provided
    if (content) {
      const validation = homepageContentSchema.safeParse(content);
      if (!validation.success) {
        return res.status(400).json(error("VALIDATION_FAILED", fromZodError(validation.error).message, 400));
      }
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
        latestArticles: homepageConfig.content.latestArticles,
        customers: content.customers || homepageConfig.content.customers
      };

      // Also update the direct carousel properties for backward compatibility
      if (homepageConfig.carousel) {
        homepageConfig.carousel.title = content.carousel?.title || homepageConfig.carousel.title;
        homepageConfig.carousel.subtitle = content.carousel?.subtitle || homepageConfig.carousel.subtitle;
      }
    }

    if (files.logo && files.logo[0]) {
      const logo = files.logo[0];
      logger.debug('[PUT] Processing logo file');

      // Use a fixed filename to avoid path issues
      const logoFileName = 'logo.png';
      // Save directly to the 'logo' directory in the project root
      const logoDir = path.join(process.cwd(), 'logo');
      const newPath = path.join(logoDir, logoFileName);

      // Ensure directory exists with proper permissions
      try {
        await fs.mkdir(logoDir, { recursive: true });
      } catch (err) {
        logger.error('[PUT] Error creating logo directory', { error: err instanceof Error ? err.message : String(err) });
        const message = err instanceof Error ? err.message : "Unknown error";
        return res.status(500).json(error("DIRECTORY_ERROR", `Failed to create logo directory: ${message}`, 500));
      }

      // Remove old logo if exists
      try {
        const oldLogoPath = path.join(logoDir, logoFileName);
        if (await fs.stat(oldLogoPath).catch(() => false)) {
          await fs.unlink(oldLogoPath);
        }
      } catch (err) {
        // Continue anyway - we'll overwrite the file
      }

      // Use a simpler, more direct approach to copy the file
      try {
        // Read the file content
        const fileContent = await fs.readFile(logo.path);

        // Write the file
        await fs.writeFile(newPath, fileContent);
      } catch (err) {
        logger.error('[PUT] Error in logo file processing', { error: err instanceof Error ? err.message : String(err) });
        const message = err instanceof Error ? err.message : "Unknown error";
        return res.status(500).json(error("WRITE_FAILED", `Failed to save logo file: ${message}`, 500));
      }

      // Set the logo path with stable version for CDN cache
      homepageConfig.logo = `/logo/logo.png?v=1`;

      // Clean up temp file
      try {
        await fs.unlink(logo.path);
      } catch (err) {
        // Ignore cleanup error
      }

      // Verify file exists
      try {
        await fs.stat(newPath);
      } catch (err) {
        logger.error('[PUT] Logo file verification failed', { error: err instanceof Error ? err.message : String(err) });
        return res.status(500).json(error("VERIFICATION_FAILED", "Logo saved but verification failed", 500));
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
      await storage.updatePageContent('homepage', { content: homepageConfig });

      // Send back updated homepage
      logger.info('[PUT] Updated homepage configuration');

      // Add a successful response
      res.status(200).json(ok({ message: "Homepage updated successfully" }));
    } catch (err) {
      logger.error('[PUT] Error updating homepage configuration', { error: err instanceof Error ? err.message : String(err) });
      res.status(500).json(error("UPDATE_FAILED", "Failed to update homepage", 500));
    }
  } catch (err) {
    logger.error('[PUT] Error processing homepage update', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json(error("SERVER_ERROR", "Internal server error", 500));
  }
});

pagesRouter.put("/homepage/carousel/reorder", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { images } = req.body;
    if (!Array.isArray(images)) {
      return res.status(400).json(error("VALIDATION_ERROR", "Invalid image array provided", 400));
    }

    homepageConfig!.carousel.images = images;
    try {
      await storage.updatePageContent('homepage', {content: homepageConfig!}); // Save to database after reorder
      res.status(200).json(ok({ message: "Image order updated successfully" }));
    } catch (saveError) {
      logger.error("Error saving reordered images", { error: saveError instanceof Error ? saveError.message : String(saveError) });
      res.status(500).json(error("SAVE_FAILED", "Failed to save image order", 500));
    }
  } catch (err) {
    logger.error("Error reordering images", { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json(error("REORDER_FAILED", "Failed to reorder images", 500));
  }
});

pagesRouter.delete('/homepage/carousel/:index', requireAuth, requireAdmin, async (req, res) => {
  try {
    const index = parseInt(req.params.index, 10);
    if (isNaN(index) || index < 0) {
      return res.status(400).json(error("INVALID_INDEX", "Invalid image index", 400));
    }

    if (!homepageConfig.carousel || !homepageConfig.carousel.images || index >= homepageConfig.carousel.images.length) {
      return res.status(404).json(error("NOT_FOUND", "Image not found", 404));
    }

    // Remove the image from the carousel
    homepageConfig.carousel.images.splice(index, 1);

    // Save the updated config to the database
    await storage.updatePageContent('homepage', { content: homepageConfig });

    res.status(200).json(ok({ message: "Image deleted successfully" }));
  } catch (err) {
    logger.error("Error deleting image", { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json(error("DELETE_FAILED", "Failed to delete image", 500));
  }
});

// Load homepage config from database on startup
(async function loadHomepageConfig() {
  try {
    logger.info("Loading homepage configuration from database");
    const storedConfig = await storage.getPageContent('homepage');
    if (storedConfig && storedConfig.content) {
      homepageConfig = storedConfig.content as HomepageConfig;

      // Initialize customers section if it doesn't exist
      if (!homepageConfig.content.customers) {
        homepageConfig.content.customers = {
          title: "Our Customers",
          subtitle: "Trusted by businesses across Indonesia",
          logos: [] as string[],
        };
      }

      // Ensure logos array exists
      if (!homepageConfig.content.customers.logos) {
        homepageConfig.content.customers.logos = [] as string[];
      }

      // Add default logos if none exist
      if (homepageConfig.content.customers.logos.length === 0) {
        homepageConfig.content.customers.logos = [
          '/logo/halal.png',
          '/logo/logo.png'
        ];
      }

      // Save any changes back to the database
      await storage.updatePageContent('homepage', { content: homepageConfig });

      logger.info("Homepage configuration loaded and updated from database");
    } else {
      logger.info("No stored homepage configuration found, using default");
    }
  } catch (err) {
    logger.error("Error loading homepage config from database", { error: err instanceof Error ? err.message : String(err) });
    logger.info("Using default homepage configuration");
  }
})();

// Clear config when server receives SIGTERM or other signals
process.on('SIGTERM', () => {
  logger.info('Server shutting down, homepage config will be refreshed on restart');
});

process.on('SIGINT', () => {
  logger.info('Server shutting down, homepage config will be refreshed on restart');
});

export default pagesRouter;