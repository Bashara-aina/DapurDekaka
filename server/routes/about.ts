import express from "express";
import { storage } from "../storage";
import { insertAboutPageSchema } from "@shared/schema";

const router = express.Router();

router.get("/api/pages/about", async (req, res) => {
  try {
    const aboutContent = await storage.getAboutPage();
    if (!aboutContent) {
      return res.status(404).json({ error: "About page content not found" });
    }
    res.json(aboutContent);
  } catch (error) {
    console.error("Error fetching about page:", error);
    res.status(500).json({ error: "Failed to fetch about page content" });
  }
});

router.put("/api/pages/about", async (req, res) => {
  try {
    const parsed = insertAboutPageSchema.parse(req.body);
    const updatedContent = await storage.updateAboutPage(parsed);
    res.json(updatedContent);
  } catch (error) {
    console.error("Error updating about page:", error);
    res.status(500).json({ error: "Failed to update about page content" });
  }
});

export default router;
