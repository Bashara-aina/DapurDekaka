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
    },
    customers: {
      title: "Our Customers",
      subtitle: "Trusted by businesses across Indonesia",
      logos: ["/logo/logo.png", "/logo/halal.png", "/logo/logo.png", "/logo/halal.png"]
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
  // Apply stronger no-cache headers
  setNoCacheHeaders(res);

  // Add logo version parameter to force client refresh
  const configWithTimestamp = {
    ...homepageConfig,
    timestamp: Date.now(),
    logo: homepageConfig.logo ? 
      (homepageConfig.logo.includes('?') ? homepageConfig.logo : `${homepageConfig.logo}?t=${Date.now()}`) : 
      homepageConfig.logo
  };

  console.log('[GET] Sending homepage data:', configWithTimestamp);
  res.json(configWithTimestamp);
});

// Add handler for customer logo uploads and processing
pagesRouter.put("/homepage/customers", upload.fields([
  { name: 'customerLogos', maxCount: 10 }
]), async (req, res) => {
  try {
    await ensureDirectories();
    setNoCacheHeaders(res);
    console.log('[PUT] Received customer files:', req.files);

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    let content;

    try {
      content = req.body.content ? JSON.parse(req.body.content) : null;
      console.log('[PUT] Received customers content update:', content);
    } catch (parseError) {
      console.error('[PUT] Error parsing customers content:', parseError);
      return res.status(400).json({ message: "Invalid content format" });
    }

    // Update customers section content
    if (content && content.customers) {
      // Initialize customers section if it doesn't exist
      if (!homepageConfig.content.customers) {
        homepageConfig.content.customers = {
          title: "Our Customers",
          subtitle: "Trusted by businesses across Indonesia",
          logos: []
        };
      }
      
      // Remove testimonials if they exist (we're not using them anymore)
      if (homepageConfig.content.customers.testimonials) {
        delete homepageConfig.content.customers.testimonials;
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
        console.log('[PUT] Customer logos directory created/verified:', customerLogosDir);
      } catch (error) {
        console.error('[PUT] Error creating customer logos directory:', error);
        return res.status(500).json({ message: `Failed to create customer logos directory: ${error.message}` });
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
        ...homepageConfig.content.customers.logos || [],
        ...newLogos
      ];
    }

    // Save the updated config to the database
    await storage.updatePageContent('homepage', {content: homepageConfig});
    
    // Send success response
    res.json({ 
      success: true, 
      message: "Customers section updated successfully",
      data: homepageConfig.content.customers
    });
  } catch (error) {
    console.error('[PUT] Error updating customers section:', error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Reorder customer logos
pagesRouter.put("/homepage/customers/logos/reorder", async (req, res) => {
  try {
    const { logos } = req.body;
    if (!Array.isArray(logos)) {
      return res.status(400).json({ message: "Invalid logos array provided" });
    }

    // Make sure we have a customers section
    if (!homepageConfig.content.customers) {
      homepageConfig.content.customers = {
        title: "Our Customers",
        subtitle: "Trusted by businesses across Indonesia",
        logos: []
      };
    }
    
    // Remove testimonials if they exist (we're not using them anymore)
    if (homepageConfig.content.customers.testimonials) {
      delete homepageConfig.content.customers.testimonials;
    }

    // Update the logos array
    homepageConfig.content.customers.logos = logos;
    
    // Save to database
    await storage.updatePageContent('homepage', {content: homepageConfig});
    
    res.json({ 
      success: true, 
      message: "Customer logos reordered successfully" 
    });
  } catch (error) {
    console.error("Error reordering customer logos:", error);
    res.status(500).json({ message: "Failed to reorder customer logos" });
  }
});

// Delete a customer logo
pagesRouter.delete('/homepage/customers/logos/:index', async (req, res) => {
  try {
    const index = parseInt(req.params.index, 10);
    if (isNaN(index) || index < 0) {
      return res.status(400).json({ message: "Invalid logo index" });
    }

    // Check if customers section and logos array exist
    if (!homepageConfig.content.customers || 
        !homepageConfig.content.customers.logos || 
        index >= homepageConfig.content.customers.logos.length) {
      return res.status(404).json({ message: "Customer logo not found" });
    }

    // Remove the logo from the array
    homepageConfig.content.customers.logos.splice(index, 1);

    // Save the updated config
    await storage.updatePageContent('homepage', {content: homepageConfig});

    res.json({ success: true, message: "Customer logo deleted successfully" });
  } catch (error) {
    console.error("Error deleting customer logo:", error);
    res.status(500).json({ message: "Failed to delete customer logo" });
  }
});

pagesRouter.put("/homepage", upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'carouselImages', maxCount: 33 },
  { name: 'customerLogos', maxCount: 10 }
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
      console.log('[PUT] Processing logo file:', logo);

      // Use a fixed filename to avoid path issues
      const logoFileName = 'logo.png';
      // Save directly to the 'logo' directory in the project root
      const logoDir = path.join(process.cwd(), 'logo');
      const newPath = path.join(logoDir, logoFileName);
      
      console.log('[PUT] Logo file details:', {
        originalFilename: logo.originalname,
        tempPath: logo.path,
        destination: newPath,
        size: logo.size
      });

      // Ensure directory exists with proper permissions
      try {
        await fs.mkdir(logoDir, { recursive: true });
        console.log('[PUT] Logo directory created/verified:', logoDir);
      } catch (error) {
        console.error('[PUT] Error creating directory:', error);
        return res.status(500).json({ message: `Failed to create logo directory: ${error.message}` });
      }

      // Remove old logo if exists
      try {
        const oldLogoPath = path.join(logoDir, logoFileName);
        if (await fs.stat(oldLogoPath).catch(() => false)) {
          await fs.unlink(oldLogoPath);
          console.log('[PUT] Removed old logo:', oldLogoPath);
        }
      } catch (error) {
        console.warn('[PUT] Could not delete old logo:', error);
        // Continue anyway - we'll overwrite the file
      }

      // Use a simpler, more direct approach to copy the file
      try {
        // Read the file content
        const fileContent = await fs.readFile(logo.path);
        console.log('[PUT] Read file content, size:', fileContent.length);
        
        // Write the file
        await fs.writeFile(newPath, fileContent);
        console.log('[PUT] Successfully wrote logo file to:', newPath);
        
        // Verify the file was written
        const stats = await fs.stat(newPath);
        console.log('[PUT] Verified logo file exists:', {
          path: newPath,
          size: stats.size
        });
      } catch (error) {
        console.error('[PUT] Error in logo file processing:', error);
        return res.status(500).json({ message: `Failed to save logo file: ${error.message}` });
      }

      // Generate a timestamp to force cache invalidation
      const timestamp = Date.now();
      // Set the logo path with timestamp for cache busting
      homepageConfig.logo = `/logo/logo.png?t=${timestamp}`;
      console.log('[PUT] Updated logo path in config:', homepageConfig.logo);

      // Clean up temp file
      try {
        await fs.unlink(logo.path);
      } catch (error) {
        console.warn('[PUT] Failed to clean up temp file:', error);
      }

      // Verify file exists and log its details
      try {
        const stats = await fs.stat(newPath);
        console.log('[PUT] Verified logo file:', {
          exists: true,
          size: stats.size,
          path: newPath,
          permissions: stats.mode.toString(8)
        });
      } catch (error) {
        console.error('[PUT] Logo file verification failed:', error);
        return res.status(500).json({ message: "Logo saved but verification failed" });
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


pagesRouter.delete('/homepage/carousel/:index', async (req, res) => {
  try {
    const index = parseInt(req.params.index, 10);
    if (isNaN(index) || index < 0) {
      return res.status(400).json({ message: "Invalid image index" });
    }

    if (!homepageConfig.carousel || !homepageConfig.carousel.images || index >= homepageConfig.carousel.images.length) {
      return res.status(404).json({ message: "Image not found" });
    }

    // Remove the image from the carousel
    homepageConfig.carousel.images.splice(index, 1);

    // Save the updated config to the database
    await storage.updatePageContent('homepage', {content: homepageConfig});

    res.json({ success: true, message: "Image deleted successfully" });
  } catch (error) {
    console.error("Error deleting image:", error);
    res.status(500).json({ message: "Failed to delete image" });
  }
});

// Load homepage config from database on startup
(async function loadHomepageConfig() {
  try {
    console.log("Loading homepage configuration from database...");
    const storedConfig = await storage.getPageContent('homepage');
    if (storedConfig && storedConfig.content) {
      homepageConfig = storedConfig.content;
      
      // Clean up any testimonials data that might exist
      if (homepageConfig.content?.customers?.testimonials) {
        delete homepageConfig.content.customers.testimonials;
        console.log("Removed deprecated testimonials data");
        // Save the cleaned config back to database
        await storage.updatePageContent('homepage', {content: homepageConfig});
      }
      
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