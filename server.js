import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);
app.use(express.json({ limit: "10mb" }));
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build"
    }
  }
});
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "Guide Tour & Order Management" });
});
app.post("/api/parse-booking-email", async (req, res) => {
  try {
    const { emailSubject = "", from = "", bodyText = "", date = "" } = req.body;
    const prompt = `You are a Tour Booking Classifier for professional private tour guides.
Analyze the following incoming email to identify whether it is a legitimate tour booking request or traveler inquiry from platforms such as TourHQ, Viator, GetYourGuide, Airbnb Experiences, TripAdvisor, or direct clients.

Email Headers:
- From: ${from}
- Subject: ${emailSubject}
- Date: ${date}

Email Body:
"""
${bodyText.slice(0, 5e3)}
"""

Classification instructions:
1. Determine if this email is an actual tour inquiry, booking request, or traveler message. Reject spam, newsletters, platform marketing announcements, password resets, or general receipts.
2. If it IS a booking inquiry, extract:
   - platform: Identify whether it's from 'TourHQ', 'Viator', 'GetYourGuide', 'Airbnb', 'Direct Email', or 'Other'.
   - clientName: Name of the prospective traveler or lead guest.
   - clientEmail: Direct email if provided or platform alias.
   - clientPhone: Phone number/WhatsApp if provided, else empty string.
   - destination: Target destination, city, or tour name (e.g., 'Samarkand Silk Road Walking Tour', 'Registan & Shakhrisabz', 'Bukhara Old Town').
   - requestedDate: Standardized date 'YYYY-MM-DD' if identifiable, or the raw requested date phrase.
   - groupSize: Number of travelers (integer; if unspecified default to 2).
   - message: Concise summary of what the client is asking for (special interests, pickup requests, language preferences).
   - confidence: 'high' if clear booking parameters exist, 'medium' if partial, 'low' if vague.`;
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isBookingRequest: { type: Type.BOOLEAN },
            platform: { type: Type.STRING },
            clientName: { type: Type.STRING },
            clientEmail: { type: Type.STRING },
            clientPhone: { type: Type.STRING },
            destination: { type: Type.STRING },
            requestedDate: { type: Type.STRING },
            groupSize: { type: Type.INTEGER },
            message: { type: Type.STRING },
            confidence: { type: Type.STRING }
          },
          required: ["isBookingRequest", "platform", "clientName", "destination", "requestedDate", "groupSize", "message", "confidence"]
        }
      }
    });
    const parsed = JSON.parse(response.text || '{"isBookingRequest": false}');
    res.json(parsed);
  } catch (error) {
    console.error("Error parsing booking email with AI:", error);
    res.status(500).json({ error: error.message || "Failed to parse booking email" });
  }
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Tour Management server running at http://0.0.0.0:${PORT}`);
  });
}
startServer();
