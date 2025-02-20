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