import React, { useState, useEffect } from 'react';
import { Order, BookingSource, OrderStatus } from '../types';
import { 
  X, 
  Check, 
  Calendar, 
  Users, 
  MapPin, 
  User as UserIcon, 
  Mail, 
  Phone, 
  Tag, 
  AlertTriangle, 
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle,
  FileText
} from 'lucide-react';

interface OrderReviewModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmToCalendar: (updatedOrder: Order, tourTime: string, reason: string) => Promise<void>;
  onSaveStatusOnly: (orderId: string, status: OrderStatus, updatedFields?: Partial<Order>) => Promise<void>;
  guideId: string;
}

const PLATFORMS: BookingSource[] = [
  'TourHQ',
  'Viator',
  'GetYourGuide',
  'Airbnb',
  'Direct Email',
  'Referral',
  'Manual / Walk-in',
  'Other',
];

export const OrderReviewModal: React.FC<OrderReviewModalProps> = ({
  order,
  isOpen,
  onClose,
  onConfirmToCalendar,
  onSaveStatusOnly,
  guideId,
}) => {
  const [platform, setPlatform] = useState<string>('TourHQ');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [destination, setDestination] = useState('');
  const [confirmedDate, setConfirmedDate] = useState('');
  const [groupSize, setGroupSize] = useState<number | ''>(2);
  const [message, setMessage] = useState('');
  const [tourTime, setTourTime] = useState('09:30 - 14:00');
  const [reason, setReason] = useState('Private Guided Tour');
  const [statusDecision, setStatusDecision] = useState<OrderStatus>('new');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (order && isOpen) {
      setPlatform(order.platform || 'TourHQ');
      setClientName(order.clientName || '');
      setClientEmail(order.clientEmail || '');
      setClientPhone(order.clientPhone || '');
      setDestination(order.destination || '');
      
      // If date is valid YYYY-MM-DD, prefill it; otherwise leave empty so guide explicitly sets it
      const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(order.requestedDate || '');
      setConfirmedDate(isValidDate ? (order.requestedDate as string) : '');
      
      setGroupSize(order.groupSize || 2);
      setMessage(order.message || '');
      setReason(order.destination ? `${order.destination} Tour` : 'Private Guided Tour');
      setStatusDecision(order.status || 'new');
      setValidationError(null);
      setIsSubmitting(false);
    }
  }, [order, isOpen]);

  if (!isOpen || !order) return null;

  const isValidIsoDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(new Date(d).getTime());

  const getUpdatedOrder = (newStatus: OrderStatus): Order => {
    return {
      ...order,
      platform,
      clientName: clientName.trim() || undefined,
      clientEmail: clientEmail.trim() || undefined,
      clientPhone: clientPhone.trim() || undefined,
      destination: destination.trim() || undefined,
      requestedDate: confirmedDate || order.requestedDate,
      isDateConfirmed: isValidIsoDate(confirmedDate),
      groupSize: typeof groupSize === 'number' ? groupSize : undefined,
      status: newStatus,
      updatedAt: new Date().toISOString(),
    };
  };

  // 1. Save status only (Reviewed or Declined or Accepted on Platform without calendar)
  const handleUpdateStatusOnly = async (status: OrderStatus) => {
    try {
      setIsSubmitting(true);
      setValidationError(null);
      await onSaveStatusOnly(order.id, status, {
        clientName: clientName.trim() || undefined,
        clientEmail: clientEmail.trim() || undefined,
        clientPhone: clientPhone.trim() || undefined,
        destination: destination.trim() || undefined,
        groupSize: typeof groupSize === 'number' ? groupSize : undefined,
        platform,
      });
      onClose();
    } catch (err: any) {
      setValidationError(err.message || 'Failed to update order status.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Confirm acceptance and add to Calendar
  const handleConfirmAndAddToCalendar = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!confirmedDate || !isValidIsoDate(confirmedDate)) {
      setValidationError('A valid confirmed date (YYYY-MM-DD) is required to add this tour to your calendar.');
      return;
    }

    if (!destination.trim()) {
      setValidationError('Please specify the tour destination / route.');
      return;
    }

    try {
      setIsSubmitting(true);
      setValidationError(null);
      const updatedOrder = getUpdatedOrder('scheduled');
      await onConfirmToCalendar(updatedOrder, tourTime, reason);
      onClose();
    } catch (err: any) {
      setValidationError(err.message || 'Failed to add tour to calendar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isOriginalDateMissing = !order.requestedDate || !isValidIsoDate(order.requestedDate);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#111827] border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto space-y-4">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Inquiry Review & Record
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
              {order.platform}
            </span>
          </div>
          <h3 className="text-lg font-bold text-white leading-tight">
            {order.emailSubject || 'Tour Booking Request'}
          </h3>
          <p className="text-xs text-slate-400">
            Verify the reservation on the platform, then record your confirmed booking on your calendar.
          </p>
        </div>

        {/* External Inspection Links */}
        <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="text-slate-300 space-y-0.5">
            <div>
              <span className="text-slate-500">From: </span>
              <span className="font-mono text-slate-200">{order.emailSender || 'Traveler'}</span>
            </div>
            <div className="text-[11px] text-slate-400">
              Received: {new Date(order.receivedAt || order.createdAt).toLocaleString()}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {order.gmailMessageUrl && (
              <a
                href={order.gmailMessageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 transition-colors font-semibold"
              >
                <Mail className="w-3.5 h-3.5 text-cyan-400" />
                <span>Open in Gmail</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
            )}

            {order.externalBookingUrl && (
              <a
                href={order.externalBookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 rounded-lg border border-amber-500/30 transition-colors font-semibold"
              >
                <span>View on {order.platform}</span>
                <ExternalLink className="w-3 h-3 text-amber-400" />
              </a>
            )}
          </div>
        </div>

        {/* Original Inquiry Message */}
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Original Traveler Message
          </label>
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-slate-300 whitespace-pre-line leading-relaxed max-h-36 overflow-y-auto">
            {order.message || 'No additional message text in email.'}
          </div>
        </div>

        {/* Date Warning if missing or unconfirmed */}
        {isOriginalDateMissing && (
          <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl text-xs text-amber-300 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-bold">Date Not Confirmed in Email</div>
              <p className="text-amber-300/90 text-[11px] leading-relaxed">
                The traveler&rsquo;s message mentioned &ldquo;{order.requestedDate || 'unspecified dates'}&rdquo;.
                Please specify the exact confirmed tour date (YYYY-MM-DD) below before scheduling to your calendar.
              </p>
            </div>
          </div>
        )}

        {validationError && (
          <div className="p-3 bg-red-950/50 border border-red-800/60 rounded-xl text-xs text-red-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Confirmation & Tour Details Form */}
        <form onSubmit={handleConfirmAndAddToCalendar} className="space-y-4 text-xs pt-1">
          
          <div className="border-t border-slate-800 pt-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span>Record Confirmed Tour Details</span>
            </h4>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Confirmed Tour Date * <span className="text-emerald-400 font-mono">(YYYY-MM-DD)</span>
              </label>
              <input
                type="date"
                required
                value={confirmedDate}
                onChange={(e) => {
                  setConfirmedDate(e.target.value);
                  setValidationError(null);
                }}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Tour Time / Duration</label>
              <input
                type="text"
                value={tourTime}
                onChange={(e) => setTourTime(e.target.value)}
                placeholder="e.g. 09:30 - 14:00"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Destination & Reason */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Destination / Route *</label>
              <input
                type="text"
                required
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g. Samarkand Registan & Silk Road Walk"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Tour Reason / Description</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Private Architecture Tour"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Client Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Client Name</label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Client Name"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Client Email</label>
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="client@email.com"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Guests</label>
              <input
                type="number"
                min={1}
                max={50}
                value={groupSize}
                onChange={(e) => setGroupSize(e.target.value ? Number(e.target.value) : '')}
                placeholder="2"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Workflow Actions */}
          <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
            
            {/* Quick status updates without calendar */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleUpdateStatusOnly('reviewed')}
                className="px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
              >
                Mark as Reviewed
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleUpdateStatusOnly('declined')}
                className="px-3 py-1.5 text-xs font-semibold text-red-300 bg-red-950/40 hover:bg-red-900/60 rounded-lg border border-red-800/60 transition-colors"
              >
                Declined
              </button>
            </div>

            {/* Confirm & Add to Calendar */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-xs rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>
                {isSubmitting ? 'Recording Tour...' : 'Accepted: Add Confirmed Tour to Calendar'}
              </span>
            </button>

          </div>

        </form>

      </div>
    </div>
  );
};
