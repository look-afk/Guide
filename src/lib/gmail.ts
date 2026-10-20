import { Order } from '../types';

export interface GmailFetchResult {
  newOrders: Order[];
  scannedCount: number;
  duplicateCount: number;
  rejectedCount: number;
}

// Helper to decode Base64URL string from Gmail API
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
    // Strip HTML tags for clean AI processing
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

export async function fetchBookingOrdersFromGmail(
  accessToken: string,
  guideId: string,
  existingMessageIds: Set<string>
): Promise<GmailFetchResult> {
  // Query Gmail for booking keywords and tour platform notifications
  const query = encodeURIComponent('TourHQ OR Viator OR GetYourGuide OR "tour booking" OR "tour inquiry" OR "private tour" OR reservation');
  const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=15`;

  const listResponse = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!listResponse.ok) {
    const errorJson = await listResponse.json().catch(() => ({}));
    throw new Error(
      errorJson.error?.message || `Gmail API returned HTTP ${listResponse.status}`
    );
  }

  const listData = await listResponse.json();
  const messages: { id: string; threadId: string }[] = listData.messages || [];

  const newOrders: Order[] = [];
  let duplicateCount = 0;
  let rejectedCount = 0;

  for (const msg of messages) {
    // 1. Check for duplicates using emailMessageId
    if (existingMessageIds.has(msg.id)) {
      duplicateCount++;
      continue;
    }

    try {
      // 2. Fetch full message
      const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`;
      const msgRes = await fetch(msgUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!msgRes.ok) continue;

      const msgData = await msgRes.json();
      const headers = msgData.payload?.headers || [];

      const subjectHeader = headers.find((h: any) => h.name?.toLowerCase() === 'subject')?.value || '';
      const fromHeader = headers.find((h: any) => h.name?.toLowerCase() === 'from')?.value || '';
      const dateHeader = headers.find((h: any) => h.name?.toLowerCase() === 'date')?.value || '';

      const bodyText = extractBodyFromPayload(msgData.payload);

      // 3. AI classification & entity extraction via /api/parse-booking-email
      const parseRes = await fetch('/api/parse-booking-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailSubject: subjectHeader,
          from: fromHeader,
          bodyText: bodyText.slice(0, 4000),
          date: dateHeader,
        }),
      });

      if (!parseRes.ok) {
        continue;
      }

      const parsed = await parseRes.json();

      // If classified as an actual booking request
      if (parsed.isBookingRequest) {
        const order: Order = {
          id: `order-gmail-${msg.id}`,
          guideId,
          emailMessageId: msg.id,
          platform: parsed.platform || 'Direct Email',
          clientName: parsed.clientName || fromHeader.split('<')[0].replace(/"/g, '').trim() || 'Traveler',
          clientEmail: parsed.clientEmail || (fromHeader.match(/<([^>]+)>/)?.[1] || ''),
          clientPhone: parsed.clientPhone || '',
          destination: parsed.destination || 'Custom Tour',
          requestedDate: parsed.requestedDate || new Date().toISOString().split('T')[0],
          groupSize: parsed.groupSize || 2,
          message: parsed.message || subjectHeader,
          status: 'new',
          confidence: (parsed.confidence as any) || 'high',
          receivedAt: dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        newOrders.push(order);
        existingMessageIds.add(msg.id);
      } else {
        rejectedCount++;
      }
    } catch (e) {
      console.warn(`Error processing message ${msg.id}:`, e);
    }
  }

  return {
    newOrders,
    scannedCount: messages.length,
    duplicateCount,
    rejectedCount,
  };
}

// Sample demo orders generator for TourHQ, Viator, and GetYourGuide
export function generateSamplePlatformOrders(guideId: string): Order[] {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 2);
  const date1 = tomorrow.toISOString().split('T')[0];

  const inFourDays = new Date();
  inFourDays.setDate(inFourDays.getDate() + 5);
  const date2 = inFourDays.toISOString().split('T')[0];

  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 9);
  const date3 = nextWeek.toISOString().split('T')[0];

  return [
    {
      id: `order-sample-tourhq-${Date.now()}-1`,
      guideId,
      emailMessageId: `msg-tourhq-${Date.now()}-1`,
      platform: 'TourHQ',
      clientName: 'Alexander Wright',
      clientEmail: 'a.wright@londonlaw.co.uk',
      clientPhone: '+44 7911 123456',
      destination: 'Samarkand Historic Monuments & Shakhrisabz Day Trip',
      requestedDate: date1,
      groupSize: 2,
      message: 'Hello! My wife and I are visiting Uzbekistan for the first time. We are looking for an in-depth architectural and history tour covering Registan, Bibi-Khanym, and Shah-i-Zinda. We prefer a comfortable pace with good photo opportunities.',
      status: 'new',
      confidence: 'high',
      receivedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: `order-sample-viator-${Date.now()}-2`,
      guideId,
      emailMessageId: `msg-viator-${Date.now()}-2`,
      platform: 'Viator',
      clientName: 'Elena Rostova',
      clientEmail: 'elena.rostova@travelers.de',
      clientPhone: '+49 170 5551234',
      destination: 'Bukhara Old Town Silk Road Walking Tour',
      requestedDate: date2,
      groupSize: 4,
      message: 'Booking Inquiry for 4 adults. We need an English-speaking guide for a full day walking tour in Bukhara, starting around 09:30 AM. Interested in visiting local artisan workshops and traditional spice markets.',
      status: 'new',
      confidence: 'high',
      receivedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: `order-sample-gyg-${Date.now()}-3`,
      guideId,
      emailMessageId: `msg-gyg-${Date.now()}-3`,
      platform: 'GetYourGuide',
      clientName: 'Marco & Sofia Rossi',
      clientEmail: 'rossi.marco.milan@gmail.com',
      clientPhone: '+39 335 1239876',
      destination: 'Samarkand Gastronomy, Bazaar & Ancient Observatories',
      requestedDate: date3,
      groupSize: 3,
      message: 'We are passionate about culinary history and astronomy. Would love to visit Ulugbek Observatory, Siab Bazaar for local sweets/bread, and enjoy authentic Samarkand plov for lunch.',
      status: 'new',
      confidence: 'high',
      receivedAt: new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  ];
}
