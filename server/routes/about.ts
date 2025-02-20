
import express from "express";
import { storage } from "../storage";
import { insertAboutPageSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { requireAuth } from "../auth";
import cors from "cors";

const router = express.Router();

router.get("/api/pages/about", cors(), async (req, res) => {
  try {
    res.setHeader('Content-Type', 'application/json');
    const aboutContent = await storage.getAboutPage();
    const defaultContent = {
      title: "About Dapur Dekaka",
      description: "",
      whyChooseTitle: "Why Choose Us",
      whyChooseDescription: "",
      mainImage: "",
      features: [
        { id: "premium", title: "", description: "", imageUrl: "" },
        { id: "handmade", title: "", description: "", imageUrl: "" },
        { id: "halal", title: "", description: "", imageUrl: "" },
        { id: "preservative", title: "", description: "", imageUrl: "" },
      ],
    };

    res.json(aboutContent || defaultContent);
  } catch (error) {
    console.error("Error fetching about page:", error);
    res.status(500).json({ error: "Failed to fetch about page content" });
  }
});

router.put("/api/pages/about", requireAuth, async (req, res) => {
  try {
    const validation = insertAboutPageSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: fromZodError(validation.error).message 
      });
    }

    const updatedContent = await storage.updateAboutPage(validation.data);
    res.json(updatedContent);
  } catch (error) {
    console.error("Error updating about page:", error);
    res.status(500).json({ 
      error: "Failed to update about page content",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export default router;
