import { Router } from "express";
import { GoogleSpreadsheet, GoogleSpreadsheetRow } from "google-spreadsheet";
import { JWT } from "google-auth-library";

const router = Router();

// Initialize Google Sheets document
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID;
const CLIENT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

router.post("/api/contact", async (req, res) => {
  try {
    const { name, email, phone, subject, message, timestamp } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !subject || !message) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (!SPREADSHEET_ID || !CLIENT_EMAIL || !PRIVATE_KEY) {
      throw new Error("Missing required Google Sheets credentials");
    }

    // Create JWT client
    const auth = new JWT({
      email: CLIENT_EMAIL,
      key: PRIVATE_KEY,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    // Initialize spreadsheet
    const doc = new GoogleSpreadsheet(SPREADSHEET_ID, auth);
    await doc.loadInfo();

    // Get the first sheet
    const sheet = doc.sheetsByIndex[0];

    // Add the row
    await sheet.addRow({
      Name: name,
      Email: email,
      Phone: phone,
      Subject: subject,
      Message: message,
      Timestamp: timestamp,
    });

    res.status(200).json({ message: "Form submitted successfully" });
  } catch (error) {
    console.error("Error submitting form:", error);
    res.status(500).json({ error: "Failed to submit form" });
  }
});

export default router;