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
  orderId?: string;
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus = 'new' | 'accepted' | 'rejected' | 'confirmed' | 'processed';

export interface Order {
  id: string;
  guideId: string;
  emailMessageId?: string;
  emailSender?: string;      // Raw "From" header from Gmail
  emailSubject?: string;     // Raw Subject line from Gmail
  platform: BookingSource | string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  destination: string;
  requestedDate: string;     // YYYY-MM-DD (or approximate text if uncertain)
  isDateConfirmed: boolean;  // True if exact YYYY-MM-DD is verified
  groupSize: number;
  message: string;
  status: OrderStatus;
  calendarTourId?: string;
  receivedAt: string;
  confidence?: 'high' | 'medium' | 'low';
  isTestOrder?: boolean;     // True only if generated as a sandbox test
  createdAt: string;
  updatedAt: string;
}

export interface BusyDateRecord {
  id: string; // YYYY-MM-DD
  guideId: string;
  date: string; // YYYY-MM-DD
  isBusy: boolean;
  reason?: string;
  tourId?: string;           // Linked tour ID if busy due to a confirmed tour
  updatedAt: string;
}

export type BusyDateMap = Record<string, BusyDateRecord>;
