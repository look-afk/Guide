import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import firebaseConfig from './firebase-applet-config.json';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '32kb' }));

// Per-user rate limiting for the AI endpoint. Use a shared store if scaling to multiple instances.
const parserRequests = new Map<string, { count: number; windowStart: number }>();
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 20;

function isRealIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

async function verifyFirebaseIdToken(req: Request): Promise<string | null> {
  const authorization = req.header('authorization') || '';
  const match = authorization.match(/^Bearer\\s+(.+)$/i);
  if (!match || !firebaseConfig.apiKey) return null;
  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: match[1] }),
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

// Server-side Gemini initialization with telemetry header
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    service: 'Guide Tour & Order Management',
    aiParserEnabled: Boolean(ai)
  });
});

// Intelligent email booking parser & classifier
app.post('/api/parse-booking-email', async (req: Request, res: Response) => {
  const userId = await verifyFirebaseIdToken(req);
  if (!userId) return res.status(401).json({ error: 'Sign in is required to parse booking emails.' });

  const now = Date.now();
  const rate = parserRequests.get(userId);
  if (!rate || now - rate.windowStart >= RATE_WINDOW_MS) {
    parserRequests.set(userId, { count: 1, windowStart: now });
  } else if (rate.count >= RATE_LIMIT) {
    return res.status(429).json({ error: 'Too many email parsing requests. Try again in a minute.' });
  } else {
    rate.count += 1;
  }

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const emailSubject = typeof body.emailSubject === 'string' ? body.emailSubject.slice(0, 500) : '';
    const from = typeof body.from === 'string' ? body.from.slice(0, 500) : '';
    const bodyText = typeof body.bodyText === 'string' ? body.bodyText.slice(0, 4500) : '';
    const date = typeof body.date === 'string' ? body.date.slice(0, 200) : '';
    if (!emailSubject && !from && !bodyText) {
      return res.status(400).json({ error: 'Email subject, sender, or body is required.' });
    }

    if (!ai) {
      return res.status(503).json({ error: 'AI parser not configured, use heuristic parser' });
    }

    const prompt = `You are a Tour Booking Classifier for professional private tour guides.
Analyze the following incoming email to identify whether it is a legitimate tour booking request or traveler inquiry from platforms such as TourHQ, Viator, GetYourGuide, Airbnb Experiences, TripAdvisor, or direct clients.

Email Headers:
- From: ${from}
- Subject: ${emailSubject}
- Date: ${date}

Email Body:
"""
${bodyText.slice(0, 5000)}
"""

Classification instructions:
1. Determine if this email is an actual tour inquiry, booking request, or traveler message. Reject spam, newsletters, platform marketing announcements, password resets, or general receipts. Do NOT classify general travel updates or generic emails as booking requests.
2. If it IS a booking inquiry, extract factual details only:
   - platform: Identify whether it's from 'TourHQ', 'Viator', 'GetYourGuide', 'Airbnb', 'Direct Email', or 'Other'.
   - clientName: Name of the prospective traveler or lead guest (leave empty string if unknown; NEVER invent a fictional name).
   - clientEmail: Direct email if provided or platform alias.
   - clientPhone: Phone number/WhatsApp if provided, else empty string.
   - destination: Target destination, city, or tour name if specified in message.
   - requestedDate: Standardized date 'YYYY-MM-DD' ONLY if an explicit tour date is specified in the message. If uncertain or unmentioned, return empty string. NEVER return today's date or the email received date as the requested tour date!
   - groupSize: Number of travelers (integer if mentioned, else 0).
   - message: Concise summary of what the client is asking for (special interests, pickup requests, language preferences).
   - confidence: 'high' if clear booking parameters exist, 'medium' if partial, 'low' if vague.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
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
          required: ['isBookingRequest', 'platform', 'clientName', 'destination', 'requestedDate', 'groupSize', 'message', 'confidence']
        }
      }
    });

    const parsed = JSON.parse(response.text || '{"isBookingRequest": false}');
    if (typeof parsed.requestedDate === 'string' && parsed.requestedDate && !isRealIsoDate(parsed.requestedDate)) {
      parsed.requestedDate = '';
    }
    res.json(parsed);
  } catch (error: any) {
    console.error('Error parsing booking email with AI:', error);
    res.status(500).json({ error: 'Failed to parse booking email.' });
  }
});

// Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Tour Management server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
