import { Order, BookingSource } from '../types';
import { checkOrderExistsByMessageId } from './firebase';

export interface GmailFetchResult {
  newOrders: Order[];
  scannedCount: number;
  duplicateCount: number;
  rejectedCount: number;
  errorCount: number;
}

// Decode Base64URL string from Gmail API
function decodeBase64Url(data: string): string {
  try {
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    return decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  } catch (e) {
    try {
      return atob(data.replace(/-/g, '+').replace(/_/g, '/'));
    } catch {
      return '';
    }
  }
}

// Extract body text recursively from Gmail payload parts
function extractBodyFromPayload(payload: any): string {
  if (!payload) return '';

  if (payload.body && payload.body.data) {
    const decoded = decodeBase64Url(payload.body.data);
    return decoded.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  if (payload.parts && Array.isArray(payload.parts)) {
    let combined = '';
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        combined += ' ' + decodeBase64Url(part.body.data);
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        const decoded = decodeBase64Url(part.body.data);
        combined += ' ' + decoded.replace(/<[^>]+>/g, ' ');
      } else if (part.parts) {
        combined += ' ' + extractBodyFromPayload(part);
      }
    }
    return combined.replace(/\s+/g, ' ').trim();
  }

  return '';
}

// Normalize date to YYYY-MM-DD if recognizable
function parseDateString(text: string): { dateStr: string; isConfirmed: boolean } {
  if (!text) return { dateStr: '', isConfirmed: false };

  // 1. Direct YYYY-MM-DD
  const isoMatch = text.match(/\b(202\d[-/](?:0[1-9]|1[0-2])[-/](?:0[1-9]|[12]\d|3[01]))\b/);
  if (isoMatch) {
    const standardized = isoMatch[1].replace(/\//g, '-');
    return { dateStr: standardized, isConfirmed: true };
  }

  // 2. Month name DD, YYYY (e.g. October 24, 2026)
  const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const monthShorts = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  const monthRegex = /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+([0-3]?\d)(?:st|nd|rd|th)?,?\s+(202\d)\b/i;
  const mMatch = text.match(monthRegex);
  if (mMatch) {
    const mStr = mMatch[1].toLowerCase();
    let mIdx = monthNames.indexOf(mStr);
    if (mIdx === -1) mIdx = monthShorts.indexOf(mStr.slice(0, 3));
    if (mIdx !== -1) {
      const monthNum = String(mIdx + 1).padStart(2, '0');
      const dayNum = String(parseInt(mMatch[2], 10)).padStart(2, '0');
      const yearNum = mMatch[3];
      return { dateStr: `${yearNum}-${monthNum}-${dayNum}`, isConfirmed: true };
    }
  }

  // 3. DD Month YYYY (e.g. 24 October 2026)
  const dayFirstRegex = /\b([0-3]?\d)(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?,?\s+(202\d)\b/i;
  const dfMatch = text.match(dayFirstRegex);
  if (dfMatch) {
    const mStr = dfMatch[2].toLowerCase();
    let mIdx = monthNames.indexOf(mStr);
    if (mIdx === -1) mIdx = monthShorts.indexOf(mStr.slice(0, 3));
    if (mIdx !== -1) {
      const monthNum = String(mIdx + 1).padStart(2, '0');
      const dayNum = String(parseInt(dfMatch[1], 10)).padStart(2, '0');
      const yearNum = dfMatch[3];
      return { dateStr: `${yearNum}-${monthNum}-${dayNum}`, isConfirmed: true };
    }
  }

  // 4. Vague date mention (e.g., "next weekend", "next month", "spring")
  const vagueMatch = text.match(/\b(next\s+\w+|sometime\s+in\s+\w+|around\s+\w+|flexible\s+dates|tentative)\b/i);
  if (vagueMatch) {
    return { dateStr: vagueMatch[0], isConfirmed: false };
  }

  return { dateStr: '', isConfirmed: false };
}

// Heuristic fallback parser if AI endpoint is unavailable or slow
function fallbackHeuristicParser(
  fromHeader: string,
  subjectHeader: string,
  bodyText: string
): {
  isBookingRequest: boolean;
  platform: BookingSource;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  destination: string;
  requestedDate: string;
  isDateConfirmed: boolean;
  groupSize: number;
  message: string;
} {
  const lowerFrom = fromHeader.toLowerCase();
  const lowerSubject = subjectHeader.toLowerCase();
  const lowerBody = bodyText.toLowerCase();

  // Detect platform
  let platform: BookingSource = 'Direct Email';
  if (lowerFrom.includes('tourhq') || lowerSubject.includes('tourhq') || lowerBody.includes('tourhq.com')) {
    platform = 'TourHQ';
  } else if (lowerFrom.includes('viator') || lowerSubject.includes('viator') || lowerBody.includes('viator.com')) {
    platform = 'Viator';
  } else if (lowerFrom.includes('getyourguide') || lowerSubject.includes('getyourguide') || lowerBody.includes('getyourguide.com')) {
    platform = 'GetYourGuide';
  } else if (lowerFrom.includes('airbnb') || lowerSubject.includes('airbnb') || lowerBody.includes('airbnb.com')) {
    platform = 'Airbnb';
  }

  // Extract email address and client name
  const emailMatch = fromHeader.match(/<([^>]+)>/);
  const clientEmail = emailMatch ? emailMatch[1] : fromHeader.trim();
  let clientName = fromHeader.split('<')[0].replace(/["']/g, '').trim();
  if (!clientName || clientName.toLowerCase().includes('notifications') || clientName.toLowerCase().includes('booking')) {
    // Try to extract client name from body or subject
    const nameFromSubject = subjectHeader.match(/from\s+([A-Za-z\s]+?)(?:\s+for|\s+-|$)/i);
    clientName = nameFromSubject ? nameFromSubject[1].trim() : 'Traveler';
  }

  // Check if it's a tour booking inquiry
  const hasBookingKeywords = 
    lowerSubject.includes('tour') || 
    lowerSubject.includes('booking') || 
    lowerSubject.includes('inquiry') ||
    lowerSubject.includes('guide') ||
    lowerSubject.includes('trip') ||
    lowerSubject.includes('itinerary') ||
    lowerSubject.includes('reservation') ||
    lowerBody.includes('tour') ||
    lowerBody.includes('guide') ||
    lowerBody.includes('availability') ||
    lowerBody.includes('itinerary') ||
    platform !== 'Direct Email';

  // Date parsing
  const parsedDate = parseDateString(`${subjectHeader} ${bodyText}`);

  // Destination from subject or body
  let destination = subjectHeader.replace(/^(re:|fwd:|tourhq:|viator:)\s*/gi, '').trim();
  if (destination.length > 80) destination = destination.slice(0, 80);
  if (!destination) destination = 'Private Guided Tour';

  // Group size regex
  const groupMatch = bodyText.match(/(\d+)\s*(?:people|adults|guests|persons|travelers|pax)/i);
  const groupSize = groupMatch ? parseInt(groupMatch[1], 10) : 2;

  // Phone regex
  const phoneMatch = bodyText.match(/(\+?\d[\d\s\-()]{7,}\d)/);
  const clientPhone = phoneMatch ? phoneMatch[1].trim() : '';

  return {
    isBookingRequest: hasBookingKeywords,
    platform,
    clientName,
    clientEmail,
    clientPhone,
    destination,
    requestedDate: parsedDate.dateStr,
    isDateConfirmed: parsedDate.isConfirmed,
    groupSize: isNaN(groupSize) || groupSize < 1 ? 2 : groupSize,
    message: bodyText.slice(0, 1000) || subjectHeader,
  };
}

export async function fetchBookingOrdersFromGmail(
  accessToken: string,
  guideId: string,
  existingMessageIds: Set<string>
): Promise<GmailFetchResult> {
  // Broad search query for booking inquiries and travel platforms
  const query = encodeURIComponent(
    'TourHQ OR Viator OR GetYourGuide OR Airbnb OR TripAdvisor OR "tour" OR "guide" OR "booking" OR "reservation" OR "trip" OR "itinerary" OR "inquiry"'
  );
  const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=25`;

  const listResponse = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!listResponse.ok) {
    const errorJson = await listResponse.json().catch(() => ({}));
    throw new Error(
      errorJson.error?.message || `Gmail API returned ${listResponse.status}. Please check permissions.`
    );
  }

  const listData = await listResponse.json();
  const messages: { id: string; threadId: string }[] = listData.messages || [];

  const newOrders: Order[] = [];
  let duplicateCount = 0;
  let rejectedCount = 0;
  let errorCount = 0;

  for (const msg of messages) {
    // 1. Check in-memory set to avoid duplicate fetching
    if (existingMessageIds.has(msg.id)) {
      duplicateCount++;
      continue;
    }

    // 2. Also check Firestore to be 100% resilient across sessions
    const alreadyInDb = await checkOrderExistsByMessageId(guideId, msg.id);
    if (alreadyInDb) {
      existingMessageIds.add(msg.id);
      duplicateCount++;
      continue;
    }

    try {
      // 3. Fetch full email payload
      const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`;
      const msgRes = await fetch(msgUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!msgRes.ok) {
        errorCount++;
        continue;
      }

      const msgData = await msgRes.json();
      const headers = msgData.payload?.headers || [];

      const subjectHeader = headers.find((h: any) => h.name?.toLowerCase() === 'subject')?.value || '(No Subject)';
      const fromHeader = headers.find((h: any) => h.name?.toLowerCase() === 'from')?.value || 'Unknown Sender';
      const dateHeader = headers.find((h: any) => h.name?.toLowerCase() === 'date')?.value || new Date().toISOString();

      const bodyText = extractBodyFromPayload(msgData.payload);

      let parsedResult: any = null;

      // 4. Try AI-powered booking parsing with quick timeout
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const parseRes = await fetch('/api/parse-booking-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            emailSubject: subjectHeader,
            from: fromHeader,
            bodyText: bodyText.slice(0, 4500),
            date: dateHeader,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (parseRes.ok) {
          parsedResult = await parseRes.json();
        }
      } catch (aiErr) {
        // AI endpoint timed out or failed; will gracefully fall back
      }

      // 5. If AI parser wasn't available or errored, use reliable heuristic parser
      if (!parsedResult) {
        const fallback = fallbackHeuristicParser(fromHeader, subjectHeader, bodyText);
        parsedResult = {
          ...fallback,
          confidence: 'medium',
        };
      }

      // 6. Check if it's an actual tour booking inquiry
      if (parsedResult.isBookingRequest) {
        const rawDate = parsedResult.requestedDate || '';
        const isDateValid = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) && !isNaN(new Date(rawDate).getTime());

        const order: Order = {
          id: `order-gmail-${msg.id}`,
          guideId,
          emailMessageId: msg.id,
          emailSender: fromHeader,
          emailSubject: subjectHeader,
          platform: parsedResult.platform || 'Direct Email',
          clientName: parsedResult.clientName || fromHeader.split('<')[0].replace(/["']/g, '').trim() || 'Traveler',
          clientEmail: parsedResult.clientEmail || (fromHeader.match(/<([^>]+)>/)?.[1] || undefined),
          clientPhone: parsedResult.clientPhone || undefined,
          destination: parsedResult.destination || subjectHeader || 'Custom Guided Tour',
          requestedDate: rawDate,
          isDateConfirmed: isDateValid,
          groupSize: parsedResult.groupSize || 2,
          message: parsedResult.message || bodyText.slice(0, 1200) || subjectHeader,
          status: 'new',
          confidence: (parsedResult.confidence as any) || 'medium',
          isTestOrder: false, // 100% genuine Gmail message
          receivedAt: new Date(dateHeader).toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        newOrders.push(order);
        existingMessageIds.add(msg.id);
      } else {
        rejectedCount++;
      }
    } catch (e) {
      console.warn(`Error processing Gmail message ${msg.id}:`, e);
      errorCount++;
    }
  }

  return {
    newOrders,
    scannedCount: messages.length,
    duplicateCount,
    rejectedCount,
    errorCount,
  };
}

// Generate explicit sandbox test inquiry (clearly marked with isTestOrder: true)
export function generateSandboxTestOrder(guideId: string): Order {
  const inThreeDays = new Date();
  inThreeDays.setDate(inThreeDays.getDate() + 3);
  const testDate = inThreeDays.toISOString().split('T')[0];

  return {
    id: `order-sandbox-${Date.now()}`,
    guideId,
    emailMessageId: `sandbox-msg-${Date.now()}`,
    emailSender: 'TourHQ Notifications <bookings@tourhq.com>',
    emailSubject: 'New Booking Inquiry: Samarkand Historic Silk Road Tour',
    platform: 'TourHQ',
    clientName: 'Sarah Jenkins (Sandbox Test)',
    clientEmail: 'sarah.j.sandbox@traveltest.com',
    clientPhone: '+1 (415) 555-0199',
    destination: 'Samarkand Registan & Shah-i-Zinda Heritage Walk',
    requestedDate: testDate,
    isDateConfirmed: true,
    groupSize: 2,
    message: 'Hello! We are looking for a certified English-speaking guide for a private half-day historical walking tour in Samarkand. We would like to visit the Registan complex and Gur-e-Amir.',
    status: 'new',
    confidence: 'high',
    isTestOrder: true, // Prominently tagged as sandbox simulation
    receivedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Generate sandbox sample orders for multi-platform preview
export function generateSamplePlatformOrders(guideId: string): Order[] {
  const d1 = new Date();
  d1.setDate(d1.getDate() + 2);
  const date1 = d1.toISOString().split('T')[0];

  const d2 = new Date();
  d2.setDate(d2.getDate() + 5);
  const date2 = d2.toISOString().split('T')[0];

  return [
    {
      id: `order-sandbox-tourhq-${Date.now()}`,
      guideId,
      emailMessageId: `sandbox-tourhq-${Date.now()}`,
      emailSender: 'TourHQ Travelers <inquiries@tourhq.com>',
      emailSubject: 'Booking Inquiry: Samarkand & Shakhrisabz Day Excursion',
      platform: 'TourHQ',
      clientName: 'David & Emma Clark',
      clientEmail: 'clark.travels@sandbox.com',
      clientPhone: '+44 7700 900123',
      destination: 'Samarkand Registan & Shakhrisabz Excursion',
      requestedDate: date1,
      isDateConfirmed: true,
      groupSize: 2,
      message: 'Greetings! We would love to book a guided historical day trip exploring the architectural landmarks of Samarkand and Amir Timur birthplace in Shakhrisabz. Need pickup from hotel.',
      status: 'new',
      confidence: 'high',
      isTestOrder: true,
      receivedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: `order-sandbox-viator-${Date.now() + 1}`,
      guideId,
      emailMessageId: `sandbox-viator-${Date.now() + 1}`,
      emailSender: 'Viator Booking Partner <lead-notification@viator.com>',
      emailSubject: 'Viator Request: Silk Road Artisan & Culinary Walk',
      platform: 'Viator',
      clientName: 'Kenji Takahashi',
      clientEmail: 'kenji.t@sandbox.jp',
      clientPhone: '+81 90 1234 5678',
      destination: 'Samarkand Artisan Workshop & Traditional Plov Tasting',
      requestedDate: date2,
      isDateConfirmed: true,
      groupSize: 4,
      message: 'Hello, we are a family of four visiting Uzbekistan. We are interested in private guiding covering paper making workshops at Konigil and old town markets.',
      status: 'new',
      confidence: 'high',
      isTestOrder: true,
      receivedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: `order-sandbox-gyg-${Date.now() + 2}`,
      guideId,
      emailMessageId: `sandbox-gyg-${Date.now() + 2}`,
      emailSender: 'GetYourGuide Supplier Service <support@getyourguide.com>',
      emailSubject: 'Inquiry: Private Samarkand Night Tour',
      platform: 'GetYourGuide',
      clientName: 'Amelie Laurent',
      clientEmail: 'amelie.laurent@sandbox.fr',
      destination: 'Samarkand Illuminated Monument Evening Tour',
      requestedDate: 'Next Friday evening',
      isDateConfirmed: false, // Uncertain date demo
      groupSize: 3,
      message: 'Bonjour! Is the night tour available next Friday evening? We are flexible by one day if your schedule is busy.',
      status: 'new',
      confidence: 'medium',
      isTestOrder: true,
      receivedAt: new Date(Date.now() - 3600000 * 6).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  ];
}
