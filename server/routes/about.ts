import express from "express";
import { storage } from "../storage";
import { pageContentSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { requireAuth } from "../auth";
import cors from "cors";

const router = express.Router();

router.get("/api/pages/about", cors(), async (req, res) => {
  try {
    const pageContent = await storage.getPageContent("about");
    const defaultContent = {
      content: {
        title: "About Dapur Dekaka",
        description: "",
        mainImage: "",
        sections: [
          {
            id: "main",
            title: "Why Choose Us",
            description: "",
            image: ""
          }
        ],
        features: [
          { id: "premium", title: "", description: "", image: "" },
          { id: "handmade", title: "", description: "", image: "" },
          { id: "halal", title: "", description: "", image: "" },
          { id: "preservative", title: "", description: "", image: "" }
        ]
      }
    };

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

export default router;