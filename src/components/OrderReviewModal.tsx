import React, { useState, useEffect } from 'react';
import { Order, BookingSource } from '../types';
import { X, Check, Calendar, Users, MapPin, User as UserIcon, Mail, Phone, Tag, AlertTriangle, ShieldCheck, Clock } from 'lucide-react';

interface OrderReviewModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmToCalendar: (updatedOrder: Order, tourTime: string, reason: string) => void;
  onSaveOnly: (updatedOrder: Order) => void;
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
  onSaveOnly,
  guideId,
}) => {
  const [platform, setPlatform] = useState<string>('TourHQ');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [destination, setDestination] = useState('');
  const [requestedDate, setRequestedDate] = useState('');
  const [groupSize, setGroupSize] = useState(2);
  const [message, setMessage] = useState('');
  const [tourTime, setTourTime] = useState('09:30 - 14:00');
  const [reason, setReason] = useState('Private Guided Tour');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (order) {
      setPlatform(order.platform || 'TourHQ');
      setClientName(order.clientName || '');
      setClientEmail(order.clientEmail || '');
      setClientPhone(order.clientPhone || '');
      setDestination(order.destination || '');
      
      // If date is valid YYYY-MM-DD, prefill it; otherwise leave empty so guide explicitly sets it
      const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(order.requestedDate || '');
      setRequestedDate(isValidDate ? order.requestedDate : '');
      
      setGroupSize(order.groupSize || 2);
      setMessage(order.message || '');
      setReason(order.destination || 'Private Guided Tour');
      setValidationError(null);
    } else {
      setPlatform('TourHQ');
      setClientName('');
      setClientEmail('');
      setClientPhone('');
      setDestination('');
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setRequestedDate(tomorrow.toISOString().split('T')[0]);
      setGroupSize(2);
      setMessage('');
      setReason('Private Guided Tour');
      setValidationError(null);
    }
  }, [order, isOpen]);

  if (!isOpen) return null;

  const isValidIsoDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(new Date(d).getTime());

  const getUpdatedOrder = (): Order => {
    const isConfirmed = isValidIsoDate(requestedDate);
    return {
      id: order?.id || `order-manual-${Date.now()}`,
      guideId,
      emailMessageId: order?.emailMessageId,
      emailSender: order?.emailSender,
      emailSubject: order?.emailSubject,
      platform,
      clientName: clientName.trim() || 'Guest',
      clientEmail: clientEmail.trim() || undefined,
      clientPhone: clientPhone.trim() || undefined,
      destination: destination.trim() || 'Custom Tour',
      requestedDate: requestedDate.trim(),
      isDateConfirmed: isConfirmed,
      groupSize: Number(groupSize) || 1,
      message: message.trim() || 'Manual booking entry',
      status: order?.status || 'new',
      receivedAt: order?.receivedAt || new Date().toISOString(),
      confidence: 'high',
      isTestOrder: order?.isTestOrder ?? false,
      createdAt: order?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  };

  const handleSaveWithoutCalendar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination.trim() || !clientName.trim()) {
      setValidationError('Please enter a destination and client name.');
      return;
    }
    onSaveOnly(getUpdatedOrder());
    onClose();
  };

  const handleConfirmAndSchedule = () => {
    if (!destination.trim() || !clientName.trim()) {
      setValidationError('Please enter a destination and client name.');
      return;
    }

    if (!isValidIsoDate(requestedDate)) {
      setValidationError('Please select a valid tour date (YYYY-MM-DD) before adding to the calendar.');
      return;
    }

    onConfirmToCalendar(getUpdatedOrder(), tourTime, reason);
    onClose();
  };

  const isOriginalDateUncertain = order && (!order.isDateConfirmed || !isValidIsoDate(order.requestedDate));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#111827] border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto space-y-4">
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
            {order?.isTestOrder ? (
              <span className="text-amber-400">Sandbox Test Review</span>
            ) : (
              <span className="flex items-center gap-1 text-cyan-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Verified Booking Review</span>
              </span>
            )}
          </div>
          <h3 className="text-lg font-bold text-white">
            {order ? `Review Booking (${order.platform})` : 'New Booking Order'}
          </h3>
          <p className="text-xs text-slate-400">
            Verify details from the traveler&rsquo;s inquiry before confirming to your guide calendar.
          </p>
        </div>

        {/* Email Source Banner if available */}
        {order?.emailSender && (
          <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs space-y-1 text-slate-300">
            <div>
              <span className="text-slate-500">Sender: </span>
              <span className="font-mono text-slate-200">{order.emailSender}</span>
            </div>
            {order.emailSubject && (
              <div>
                <span className="text-slate-500">Subject: </span>
                <span className="italic text-slate-200">{order.emailSubject}</span>
              </div>
            )}
          </div>
        )}

        {/* Uncertain Date Notice */}
        {isOriginalDateUncertain && (
          <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl text-xs text-amber-300 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-bold">Date Verification Required</div>
              <p className="text-amber-300/90 text-[11px] leading-relaxed">
                The traveler&rsquo;s message mentioned: &ldquo;{order.requestedDate || 'flexible / unspecified dates'}&rdquo;.
                Please specify an exact confirmed date below before adding this booking to your calendar.
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

        <form onSubmit={handleSaveWithoutCalendar} className="space-y-4 text-xs">
          
          {/* Platform & Group Size */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Booking Platform</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Group Size (Guests)</label>
              <input
                type="number"
                min={1}
                max={50}
                value={groupSize}
                onChange={(e) => setGroupSize(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Client Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Client / Lead Guest *</label>
              <input
                type="text"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Elena Rostova"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Client Email</label>
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="client@example.com"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Client Phone / WhatsApp</label>
              <input
                type="tel"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="+998 90 123 4567"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Destination / Route *</label>
              <input
                type="text"
                required
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g. Samarkand Silk Road Walking Tour"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Date & Time Slot */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Confirmed Tour Date * <span className="text-emerald-400">(Required for Calendar)</span>
              </label>
              <input
                type="date"
                required
                value={requestedDate}
                onChange={(e) => {
                  setRequestedDate(e.target.value);
                  setValidationError(null);
                }}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Tour Time Slot</label>
              <input
                type="text"
                value={tourTime}
                onChange={(e) => setTourTime(e.target.value)}
                placeholder="e.g. 09:30 - 14:00"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Tour Reason / Type</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Private Cultural Walking Tour"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Original Client Inquiry Message */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Client Inquiry / Email Text</label>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Inquiry text from client or platform..."
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Action buttons */}
          <div className="pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="px-3.5 py-2 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700"
              >
                Save Changes Only
              </button>

              <button
                type="button"
                onClick={handleConfirmAndSchedule}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-xs rounded-lg shadow-sm transition-colors"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Confirm & Add to Calendar</span>
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
};
