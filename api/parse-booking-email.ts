import { GoogleGenAI, Type } from "@google/genai";
import firebaseConfig from "../firebase-applet-config.json";

const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 20;
const requests = new Map<string, { count: number; windowStart: number }>();

function isRealIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

async function verifyFirebaseIdToken(token: string): Promise<string | null> {
  if (!firebaseConfig.apiKey) return null;
  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: token }),
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!response.ok) return null;
    const data = await response.json() as { users?: Array<{ localId?: string }> };
    return data.users?.[0]?.localId || null;
  } catch {
    return null;
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const authorization = typeof req.headers?.authorization === "string" ? req.headers.authorization : "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return res.status(401).json({ error: "Sign in is required to parse booking emails." });

  const userId = await verifyFirebaseIdToken(match[1]);
  if (!userId) return res.status(401).json({ error: "Sign in is required to parse booking emails." });

  const now = Date.now();
  const rate = requests.get(userId);
  if (!rate || now - rate.windowStart >= RATE_WINDOW_MS) {
    requests.set(userId, { count: 1, windowStart: now });
  } else if (rate.count >= RATE_LIMIT) {
    return res.status(429).json({ error: "Too many email parsing requests. Try again in a minute." });
  } else {
    rate.count += 1;
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const emailSubject = typeof body.emailSubject === "string" ? body.emailSubject.slice(0, 500) : "";
  const from = typeof body.from === "string" ? body.from.slice(0, 500) : "";
  const bodyText = typeof body.bodyText === "string" ? body.bodyText.slice(0, 4500) : "";
  const date = typeof body.date === "string" ? body.date.slice(0, 200) : "";
  if (!emailSubject && !from && !bodyText) {
    return res.status(400).json({ error: "Email subject, sender, or body is required." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "AI parser not configured, use heuristic parser." });

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `You are a Tour Booking Classifier for professional private tour guides.
Analyze the incoming email and determine whether it is a real tour booking request or traveler inquiry from TourHQ, Viator, GetYourGuide, Airbnb Experiences, TripAdvisor, or a direct client.

Email headers:
- From: ${from}
- Subject: ${emailSubject}
- Date: ${date}

Email body:
"""
${bodyText}
"""

Reject spam, newsletters, marketing announcements, password resets, receipts, and generic travel updates. Do not classify a message as a booking just because it mentions a platform.
If it is a booking inquiry, extract factual details only:
- platform: TourHQ, Viator, GetYourGuide, Airbnb, Direct Email, or Other
- clientName: prospective traveler or lead guest; empty if unknown, never invent a name
- clientEmail: direct email or platform alias if provided
- clientPhone: phone/WhatsApp if provided, else empty
- destination: city, destination, or tour name if specified
- requestedDate: YYYY-MM-DD only if an explicit tour date is stated; otherwise empty. Never use today's date or email date.
- groupSize: number of travelers if stated, otherwise 0
- message: concise summary of the request
- confidence: high, medium, or low`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
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
            confidence: { type: Type.STRING },
          },
          required: ["isBookingRequest", "platform", "clientName", "destination", "requestedDate", "groupSize", "message", "confidence"],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{"isBookingRequest":false}');
    if (parsed.requestedDate && !isRealIsoDate(parsed.requestedDate)) parsed.requestedDate = "";
    return res.status(200).json(parsed);
  } catch (error) {
    console.error("Error parsing booking email with AI:", error);
    return res.status(500).json({ error: "Failed to parse booking email." });
  }
}
