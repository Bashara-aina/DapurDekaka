import express from "express";
import { storage } from "../storage";
import { pageContentSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { requireAuth } from "../auth";
import cors from "cors";
import { upload } from "../storage";
import fs from "fs/promises";
import path from "path";

const router = express.Router();

// Ensure directories exist
async function ensureDirectories() {
  const assetDir = path.join(process.cwd(), 'public', 'asset');
  const aboutDir = path.join(process.cwd(), 'public', 'asset', 'about');
  
  try {
    await fs.mkdir(assetDir, { recursive: true });
    await fs.mkdir(aboutDir, { recursive: true });
    console.log("Directories created/verified successfully");
  } catch (error) {
    console.error("Error creating directories:", error);
    throw error;
  }
}

router.get("/api/pages/about", cors(), async (req, res) => {
  try {
    const pageContent = await storage.getPageContent("about");
    const defaultContent = {
      content: {
        title: "About Dapur Dekaka",
        description: "",
        mainImage: "/asset/28.jpg",
        mainDescription: "Dapur Dekaka adalah produsen frozen food dimsum berbagai varian. Berlokasi di Bandung, kami telah mendistribusikan produk sampai ke Jakarta, Bekasi, Tangerang, dan Palembang. Produk kami dibuat dengan resep khas turun temurun yang sudah lebih dari 5 tahun, alur produksinya memperhatikan keamanan pangan, kebersihan terjamin, tidak pakai pengawet, tidak pakai pewarna buatan. Prioritas kami terhadap konsistensi kualitas menjadikan kami selalu dipercaya oleh restoran, kafe, reseller, dan para pengusaha sebagai mitra.",
        sections: [
          {
            title: "Di Dapur Dekaka",
            description: "Di Dapur Dekaka, kami sangat bersemangat untuk menghadirkan cita rasa otentik dim sum buatan tangan ke meja Anda. Berbasis di Bandung, kami bangga memberikan produk berkualitas tinggi yang menonjol karena rasa dan integritasnya. Inilah alasan mengapa Anda harus memilih kami:"
          }
        ],
        features: [
          {
            id: "premium",
            title: "Bahan-bahan Premium",
            description: "Kami hanya menggunakan bahan-bahan terbaik untuk memastikan rasa dan kualitas yang luar biasa.",
            image: "/asset/premium-ingredients.jpg"
          },
          {
            id: "handmade",
            title: "Keunggulan Buatan Tangan",
            description: "Setiap potongan dim sum dibuat dengan hati-hati, mempertahankan sentuhan tradisional.",
            image: "/asset/handmade.jpg"
          },
          {
            id: "halal",
            title: "Bersertifikat Halal",
            description: "Nikmati produk kami dengan tenang, karena telah memenuhi standar halal tertinggi.",
            image: "/asset/halal-certified.jpg"
          },
          {
            id: "preservative",
            title: "Tanpa Pengawet",
            description: "Kesegaran dan rasa alami adalah prioritas kami, tanpa bahan pengawet.",
            image: "/asset/no-preservatives.jpg"
          }
        ]
      }
    };

    // Add a timestamp parameter to force image refresh
    const timestamp = Date.now();
    if (pageContent && pageContent.content) {
      const aboutContent = pageContent.content as {
        title: string;
        description: string;
        mainImage: string;
        mainDescription: string;
        sections: { title: string; description: string; }[];
        features: { id: string; title: string; description: string; image: string; }[];
      };
      
      // Add timestamp to main image
      if (aboutContent.mainImage) {
        const imageUrl = aboutContent.mainImage;
        aboutContent.mainImage = imageUrl.includes('?') 
          ? imageUrl
          : `${imageUrl}?t=${timestamp}`;
      }
      
      // Add timestamp to feature images
      if (aboutContent.features && Array.isArray(aboutContent.features)) {
        aboutContent.features = aboutContent.features.map(feature => {
          if (feature.image) {
            const imageUrl = feature.image;
            return {
              ...feature,
              image: imageUrl.includes('?') ? imageUrl : `${imageUrl}?t=${timestamp}`
            };
          }
          return feature;
        });
      }
      
      // Update the pageContent
      pageContent.content = aboutContent;
    }

    res.json(pageContent || defaultContent);
  } catch (error) {
    console.error("Error fetching about page:", error);
    res.status(500).json({ error: "Failed to fetch about page content" });
  }
});

router.put("/api/pages/about", requireAuth, async (req, res) => {
  try {
    const validation = pageContentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: fromZodError(validation.error).message
      });
    }

    const updatedContent = await storage.updatePageContent("about", validation.data);
    res.json(updatedContent);
  } catch (error) {
    console.error("Error updating about page:", error);
    res.status(500).json({
      error: "Failed to update about page content",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Handle file uploads for the about page
router.post("/api/pages/about/upload", requireAuth, upload.fields([
  { name: 'mainImage', maxCount: 1 },
  { name: 'featureImage_premium', maxCount: 1 },
  { name: 'featureImage_handmade', maxCount: 1 },
  { name: 'featureImage_halal', maxCount: 1 },
  { name: 'featureImage_preservative', maxCount: 1 }
]), async (req, res) => {
  try {
    await ensureDirectories();
    console.log('[POST] About page received files:', req.files);
    
    let contentObj;
    try {
      contentObj = req.body.content ? JSON.parse(req.body.content) : null;
      console.log('[POST] About page received content:', contentObj);
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
        const mainImageFilename = `about-main${ext}`;
        const newPath = path.join(process.cwd(), 'public', 'asset', 'about', mainImageFilename);
        
        // Move file from temp upload location to final destination
        await fs.rename(mainImageFile.path, newPath);
        
        // Update the content object with new image path
        contentObj.mainImage = `/asset/about/${mainImageFilename}`;
        
        console.log(`[POST] Moved main image to ${newPath}`);
      } catch (error) {
        console.error('[POST] Error processing main image:', error);
        return res.status(500).json({ message: "Error processing main image" });
      }
    }
    
    // Process feature images if provided
    const featureIds = ['premium', 'handmade', 'halal', 'preservative'];
    
    for (const featureId of featureIds) {
      const fieldName = `featureImage_${featureId}`;
      
      if (files[fieldName] && files[fieldName].length > 0) {
        try {
          const featureFile = files[fieldName][0];
          const ext = path.extname(featureFile.originalname);
          const featureFilename = `about-feature-${featureId}${ext}`;
          const newPath = path.join(process.cwd(), 'public', 'asset', 'about', featureFilename);
          
          // Move file from temp upload location to final destination
          await fs.rename(featureFile.path, newPath);
          
          // Update the feature image in content object
          const featureIndex = contentObj.features.findIndex((feature: any) => feature.id === featureId);
          if (featureIndex !== -1) {
            contentObj.features[featureIndex].image = `/asset/about/${featureFilename}`;
          }
          
          console.log(`[POST] Moved feature image (${featureId}) to ${newPath}`);
        } catch (error) {
          console.error(`[POST] Error processing feature image (${featureId}):`, error);
          return res.status(500).json({ message: `Error processing feature image (${featureId})` });
        }
      }
    }
    
    // Save updated content to database
    const updatedContent = await storage.updatePageContent("about", { content: contentObj });
    
    res.json({ 
      success: true, 
      message: "About page updated successfully with file uploads", 
      content: updatedContent 
    });
  } catch (error) {
    console.error('[POST] Error handling about page file uploads:', error);
    res.status(500).json({
      error: "Failed to process file uploads",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export default router;