import { Order, BookingSource } from '../types';
import { checkOrderExistsByMessageId, auth } from './firebase';

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

// Extract body text and raw HTML recursively from Gmail payload parts
function extractEmailContent(payload: any): { plainText: string; htmlText: string } {
  if (!payload) return { plainText: '', htmlText: '' };

  let plainText = '';
  let htmlText = '';

  if (payload.body && payload.body.data) {
    const decoded = decodeBase64Url(payload.body.data);
    if (payload.mimeType === 'text/html') {
      htmlText += decoded;
      plainText += decoded.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    } else {
      plainText += decoded;
    }
  }

  if (payload.parts && Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        plainText += ' ' + decodeBase64Url(part.body.data);
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        const decoded = decodeBase64Url(part.body.data);
        htmlText += ' ' + decoded;
        plainText += ' ' + decoded.replace(/<[^>]+>/g, ' ');
      } else if (part.parts) {
        const nested = extractEmailContent(part);
        plainText += ' ' + nested.plainText;
        htmlText += ' ' + nested.htmlText;
      }
    }
  }

  return {
    plainText: plainText.replace(/\s+/g, ' ').trim(),
    htmlText: htmlText.trim()
  };
}

// Extract genuine platform booking links from HTML or body
function extractPlatformBookingLink(html: string, plainText: string, platform: BookingSource): string | undefined {
  const combined = `${html} ${plainText}`;
  const urlRegex = /https?:\/\/[^\s<>"'{}|\\^`]+[a-zA-Z0-9/]/g;
  const urls = combined.match(urlRegex) || [];

  // 1. Look for platform specific inquiry / booking management links
  for (const url of urls) {
    const lower = url.toLowerCase();
    if (platform === 'TourHQ' && (lower.includes('tourhq.com/guide/inquiry') || lower.includes('tourhq.com/booking') || lower.includes('tourhq.com/message'))) {
      return url;
    }
    if (platform === 'Viator' && (lower.includes('viator.com/supplier') || lower.includes('viator.com/booking') || lower.includes('viator.com/manage'))) {
      return url;
    }
    if (platform === 'GetYourGuide' && (lower.includes('getyourguide.com/supplier') || lower.includes('getyourguide.com/booking'))) {
      return url;
    }
    if (platform === 'Airbnb' && (lower.includes('airbnb.com/hosting') || lower.includes('airbnb.com/reservation') || lower.includes('airbnb.com/messaging'))) {
      return url;
    }
  }

  // 2. Fallback: look for general booking / inquiry links from the matching platform
  for (const url of urls) {
    const lower = url.toLowerCase();
    if (platform === 'TourHQ' && lower.includes('tourhq.com') && !lower.includes('unsubscribe') && !lower.includes('privacy')) {
      return url;
    }
    if (platform === 'Viator' && lower.includes('viator.com') && !lower.includes('unsubscribe')) {
      return url;
    }
    if (platform === 'GetYourGuide' && lower.includes('getyourguide.com') && !lower.includes('unsubscribe')) {
      return url;
    }
    if (platform === 'Airbnb' && lower.includes('airbnb.com') && !lower.includes('unsubscribe')) {
      return url;
    }
  }

  return undefined;
}

function isRealIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

// Parse explicit calendar dates from subject or body (strictly avoids guessing or substituting today)
function parseExactDateString(text: string): { dateStr?: string; isConfirmed: boolean } {
  if (!text) return { isConfirmed: false };

  // 1. YYYY-MM-DD format
  const isoMatch = text.match(/\b(202\d[-/](?:0[1-9]|1[0-2])[-/](?:0[1-9]|[12]\d|3[01]))\b/);
  if (isoMatch) {
    const candidate = isoMatch[1].replace(/\//g, '-');
    return isRealIsoDate(candidate) ? { dateStr: candidate, isConfirmed: true } : { isConfirmed: false };
  }

  // 2. Month DD, YYYY format
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
      const candidate = `${yearNum}-${monthNum}-${dayNum}`;
      return isRealIsoDate(candidate) ? { dateStr: candidate, isConfirmed: true } : { isConfirmed: false };
    }
  }

  // 3. DD Month YYYY format
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
      const candidate = `${yearNum}-${monthNum}-${dayNum}`;
      return isRealIsoDate(candidate) ? { dateStr: candidate, isConfirmed: true } : { isConfirmed: false };
    }
  }

  // 4. Approximate date phrase
  const vagueMatch = text.match(/\b(next\s+\w+|sometime\s+in\s+\w+|around\s+\w+|flexible\s+dates|tentative|in\s+(?:january|february|march|april|may|june|july|august|september|october|november|december))\b/i);
  if (vagueMatch) {
    return { dateStr: vagueMatch[0], isConfirmed: false };
  }

  // If no date was found, leave undefined so user knows it's unconfirmed!
  return { dateStr: undefined, isConfirmed: false };
}

// Multi-evidence heuristic parser
function fallbackHeuristicParser(
  fromHeader: string,
  subjectHeader: string,
  bodyText: string
): {
  isBookingRequest: boolean;
  platform: BookingSource;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  destination?: string;
  requestedDate?: string;
  isDateConfirmed: boolean;
  groupSize?: number;
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

  // Multi-evidence check: Never treat an email as a booking inquiry solely because it contains the word "tour"!
  const hasStrongSubjectSignal = 
    lowerSubject.includes('booking request') ||
    lowerSubject.includes('new inquiry') ||
    lowerSubject.includes('booking inquiry') ||
    lowerSubject.includes('tour inquiry') ||
    lowerSubject.includes('guide reservation') ||
    lowerSubject.includes('reservation request') ||
    lowerSubject.includes('new message from') ||
    lowerSubject.includes('new traveler message') ||
    lowerSubject.includes('tour request');

  const hasBodyInquirySignal = 
    lowerBody.includes('would like to book') ||
    lowerBody.includes('are you available') ||
    lowerBody.includes('interested in a tour') ||
    lowerBody.includes('interested in booking') ||
    lowerBody.includes('inquiry from') ||
    lowerBody.includes('new booking request') ||
    lowerBody.includes('new message from your guest') ||
    lowerBody.includes('sent you a message') ||
    lowerBody.includes('inquiry about your tour') ||
    lowerBody.includes('guest wants to book') ||
    lowerBody.includes('traveler is interested');

  // Reject pure marketing, spam, newsletters, password resets
  const isExcluded = 
    lowerSubject.includes('newsletter') ||
    lowerSubject.includes('reset password') ||
    lowerSubject.includes('verification code') ||
    lowerSubject.includes('terms of service') ||
    lowerSubject.includes('marketing') ||
    lowerSubject.includes('weekly digest') ||
    lowerSubject.includes('unsubscribe') ||
    lowerSubject.includes('special offer') ||
    lowerSubject.includes('limited-time offer') ||
    lowerSubject.includes('discount') ||
    lowerSubject.includes('monthly report') ||
    lowerSubject.includes('newsletter');

  // A platform sender alone is not enough: newsletters and generic platform notifications are common.
  const isBookingRequest = !isExcluded && (hasStrongSubjectSignal || hasBodyInquirySignal);

  // Extract client name and email if available
  const emailMatch = fromHeader.match(/<([^>]+)>/);
  const clientEmail = emailMatch ? emailMatch[1] : (fromHeader.includes('@') ? fromHeader.trim() : undefined);
  
  let clientName: string | undefined = undefined;
  const rawSenderName = fromHeader.split('<')[0].replace(/["']/g, '').trim();
  if (rawSenderName && !rawSenderName.toLowerCase().includes('notification') && !rawSenderName.toLowerCase().includes('booking') && !rawSenderName.toLowerCase().includes('support')) {
    clientName = rawSenderName;
  } else {
    // Try to find "from <Name>" in subject
    const nameMatch = subjectHeader.match(/from\s+([A-Za-z\s]+?)(?:\s+for|\s+-|$)/i);
    if (nameMatch) {
      clientName = nameMatch[1].trim();
    }
  }

  // Destination from subject or body
  let destination: string | undefined = subjectHeader.replace(/^(re:|fwd:|tourhq:|viator:)\s*/gi, '').trim();
  if (destination.length > 90) destination = destination.slice(0, 90);
  if (!destination || destination.toLowerCase().includes('new inquiry') || destination.toLowerCase().includes('booking request')) {
    destination = undefined; // Don't invent destination
  }

  // Date parsing
  const parsedDate = parseExactDateString(`${subjectHeader} ${bodyText}`);

  // Group size regex
  const groupMatch = bodyText.match(/(\d+)\s*(?:people|adults|guests|persons|travelers|pax)/i);
  const groupSize = groupMatch ? parseInt(groupMatch[1], 10) : undefined;

  // Phone regex
  const phoneMatch = bodyText.match(/(\+?\d[\d\s\-()]{7,}\d)/);
  const clientPhone = phoneMatch ? phoneMatch[1].trim() : undefined;

  return {
    isBookingRequest,
    platform,
    clientName,
    clientEmail,
    clientPhone,
    destination,
    requestedDate: parsedDate.dateStr,
    isDateConfirmed: parsedDate.isConfirmed,
    groupSize,
    message: bodyText.slice(0, 1500) || subjectHeader,
  };
}

export async function fetchBookingOrdersFromGmail(
  accessToken: string,
  guideId: string,
  existingMessageIds: Set<string>
): Promise<GmailFetchResult> {
  // Targeted search query for booking inquiries and travel platforms
  const query = encodeURIComponent(
    'from:(tourhq.com OR viator.com OR getyourguide.com OR airbnb.com OR tripadvisor.com) OR "TourHQ" OR "Viator" OR "GetYourGuide" OR "booking inquiry" OR "tour booking" OR "guide reservation" OR "new booking request"'
  );
  const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=30`;

  const listResponse = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!listResponse.ok) {
    const errorJson = await listResponse.json().catch(() => ({}));
    throw new Error(
      errorJson.error?.message || `Gmail API error (${listResponse.status}). Please check authorization.`
    );
  }

  const listData = await listResponse.json();
  const messages: { id: string; threadId: string }[] = listData.messages || [];

  const newOrders: Order[] = [];
  let duplicateCount = 0;
  let rejectedCount = 0;
  let errorCount = 0;

  for (const msg of messages) {
    // 1. Check in-memory set to prevent duplicate extraction
    if (existingMessageIds.has(msg.id)) {
      duplicateCount++;
      continue;
    }

    // 2. Check Firestore persistent storage to ensure deduplication
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

      const { plainText, htmlText } = extractEmailContent(msgData.payload);

      let parsedResult: any = null;

      // 4. Try AI-powered booking parsing with timeout
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const idToken = await auth.currentUser?.getIdToken();
        const parseRes = await fetch('/api/parse-booking-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
          },
          body: JSON.stringify({
            emailSubject: subjectHeader,
            from: fromHeader,
            bodyText: plainText.slice(0, 4500),
            date: dateHeader,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (parseRes.ok) {
          parsedResult = await parseRes.json();
        }
      } catch {
        // Fall back gracefully to multi-evidence heuristic parser
      }

      if (!parsedResult) {
        const fallback = fallbackHeuristicParser(fromHeader, subjectHeader, plainText);
        parsedResult = {
          ...fallback,
          confidence: 'medium',
        };
      }

      // 5. Only save if it is a genuine booking inquiry
      if (parsedResult.isBookingRequest) {
        const detectedPlatform: BookingSource = parsedResult.platform || 'Direct Email';
        const externalBookingLink = extractPlatformBookingLink(htmlText, plainText, detectedPlatform);
        const gmailDirectUrl = `https://mail.google.com/mail/u/0/#inbox/${msg.id}`;

        const rawDate = parsedResult.requestedDate || '';
        const isDateValid = isRealIsoDate(rawDate);

        const order: Order = {
          id: `order-${msg.id}`, // Stable deterministic ID based on Gmail Message ID
          guideId,
          emailMessageId: msg.id,
          emailSender: fromHeader,
          emailSubject: subjectHeader,
          platform: detectedPlatform,
          clientName: parsedResult.clientName || undefined,
          clientEmail: parsedResult.clientEmail || (fromHeader.match(/<([^>]+)>/)?.[1] || undefined),
          clientPhone: parsedResult.clientPhone || undefined,
          destination: parsedResult.destination || undefined,
          requestedDate: rawDate || undefined,
          isDateConfirmed: isDateValid,
          groupSize: parsedResult.groupSize || undefined,
          message: parsedResult.message || plainText.slice(0, 1200) || subjectHeader,
          status: 'new',
          confidence: (parsedResult.confidence as any) || 'medium',
          gmailMessageUrl: gmailDirectUrl,
          externalBookingUrl: externalBookingLink,
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
