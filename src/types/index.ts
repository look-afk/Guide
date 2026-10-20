export interface GuideProfile {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: 'guide';
  updatedAt: string;
}

export type BookingSource = 
  | 'TourHQ' 
  | 'Viator' 
  | 'GetYourGuide' 
  | 'Airbnb' 
  | 'Direct Email' 
  | 'Referral' 
  | 'Manual / Walk-in' 
  | 'Other';

export interface Tour {
  id: string;
  guideId: string;
  destination: string;
  date: string; // YYYY-MM-DD
  time: string; // e.g. "09:30 - 13:30"
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  groupSize?: number;
  reason: string; // e.g. "Full Day Walking Tour", "Archaeological Exploration"
  bookingSource: BookingSource | string;
  status: 'confirmed' | 'completed' | 'cancelled';
  notes?: string;
  orderId?: string; // Linked order ID if originated from a booking inquiry
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus = 
  | 'new'                 // New inquiry from email, not yet reviewed
  | 'reviewed'            // Guide has reviewed the inquiry
  | 'accepted_externally' // Guide accepted the reservation on the platform
  | 'declined'            // Guide declined/rejected the inquiry
  | 'scheduled';          // Confirmed and added to the Guide's calendar

export interface Order {
  id: string;
  guideId: string;
  emailMessageId?: string;
  emailSender?: string;         // Raw "From" header from Gmail
  emailSubject?: string;        // Raw Subject line from Gmail
  platform: BookingSource | string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  destination?: string;
  requestedDate?: string;       // YYYY-MM-DD (or phrase if uncertain)
  isDateConfirmed: boolean;     // True only if exact YYYY-MM-DD is verified
  groupSize?: number;
  message: string;              // Message excerpt or body text
  status: OrderStatus;
  calendarTourId?: string;      // Linked tour ID once added to calendar
  gmailMessageUrl?: string;     // Direct link to open the email in Gmail
  externalBookingUrl?: string;  // Direct link to the booking on TourHQ, Viator, etc.
  receivedAt: string;           // Date email was received
  confidence?: 'high' | 'medium' | 'low';
  createdAt: string;
  updatedAt: string;
}

export interface BusyDateRecord {
  id: string; // YYYY-MM-DD
  guideId: string;
  date: string; // YYYY-MM-DD
  isBusy: boolean;
  isManualBlock?: boolean; // True if manually blocked by the guide (e.g. day off / personal)
  manualBlockReason?: string; // Kept separately so a manual block never overwrites tour details
  reason?: string;         // e.g. "Private tour — Samarkand — unavailable for other bookings"
  tourId?: string;         // Linked tour ID if busy due to a confirmed tour
  updatedAt: string;
}

export type BusyDateMap = Record<string, BusyDateRecord>;
