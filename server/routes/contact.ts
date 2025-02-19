import { Router } from "express";

const router = Router();

router.post("/api/contact", async (req, res) => {
  try {
    const { name, email, phone, subject, message, timestamp } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !subject || !message) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Here you can add alternative contact form handling logic if needed
    // For now just return success
    res.status(200).json({ message: "Form submitted successfully" });
  } catch (error) {
    console.error("Error submitting form:", error);
    res.status(500).json({ error: "Failed to submit form" });
  }
});

export default router;