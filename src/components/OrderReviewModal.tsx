import React, { useState, useEffect } from 'react';
import { Order, BookingSource } from '../types';
import { X, Check, Calendar, Users, MapPin, User as UserIcon, Mail, Phone, Tag } from 'lucide-react';

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

  useEffect(() => {
    if (order) {
      setPlatform(order.platform || 'TourHQ');
      setClientName(order.clientName || '');
      setClientEmail(order.clientEmail || '');
      setClientPhone(order.clientPhone || '');
      setDestination(order.destination || '');
      setRequestedDate(order.requestedDate || new Date().toISOString().split('T')[0]);
      setGroupSize(order.groupSize || 2);
      setMessage(order.message || '');
      setReason(order.destination || 'Private Guided Tour');
    } else {
      setPlatform('TourHQ');
      setClientName('');
      setClientEmail('');
      setClientPhone('');
      setDestination('');
      setRequestedDate(new Date().toISOString().split('T')[0]);
      setGroupSize(2);
      setMessage('');
      setReason('Private Guided Tour');
    }
  }, [order, isOpen]);

  if (!isOpen) return null;

  const getUpdatedOrder = (): Order => {
    return {
      id: order?.id || `order-manual-${Date.now()}`,
      guideId,
      emailMessageId: order?.emailMessageId,
      platform,
      clientName: clientName.trim() || 'Guest',
      clientEmail: clientEmail.trim() || undefined,
      clientPhone: clientPhone.trim() || undefined,
      destination: destination.trim() || 'Custom Tour',
      requestedDate: requestedDate.trim() || new Date().toISOString().split('T')[0],
      groupSize: Number(groupSize) || 1,
      message: message.trim() || 'Manual booking entry',
      status: order?.status || 'new',
      receivedAt: order?.receivedAt || new Date().toISOString(),
      confidence: 'high',
      createdAt: order?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  };

  const handleSaveWithoutCalendar = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveOnly(getUpdatedOrder());
    onClose();
  };

  const handleConfirmAndSchedule = () => {
    onConfirmToCalendar(getUpdatedOrder(), tourTime, reason);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#111827] border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
            <span>Review & Verify Order Details</span>
          </div>
          <h3 className="text-base font-bold text-white">
            {order ? `Review Booking (${order.platform})` : 'New Booking Order'}
          </h3>
          <p className="text-xs text-slate-400">
            Verify extracted details or correct any missing information before confirming.
          </p>
        </div>

        <form onSubmit={handleSaveWithoutCalendar} className="space-y-4 text-xs">
          {/* Platform & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Booking Platform</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Group Size</label>
              <input
                type="number"
                min={1}
                max={50}
                value={groupSize}
                onChange={(e) => setGroupSize(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Client Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Client Name *</label>
              <input
                type="text"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Elena Rostova"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Client Email</label>
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="client@example.com"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Destination & Requested Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Destination / Route *</label>
              <input
                type="text"
                required
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g. Samarkand Silk Road Tour"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Requested Date *</label>
              <input
                type="date"
                required
                value={requestedDate}
                onChange={(e) => setRequestedDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Tour Time slot for calendar */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Tour Time Slot</label>
              <input
                type="text"
                value={tourTime}
                onChange={(e) => setTourTime(e.target.value)}
                placeholder="e.g. 09:30 - 14:00"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Tour Type / Reason</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Private Walking Tour"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Client Message */}
          <div>
            <label className="block text-slate-300 font-medium mb-1">Client Message / Inquiry Details</label>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Inquiry text from client or platform..."
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="px-3.5 py-2 text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg font-medium transition-colors"
              >
                Save Details Only
              </button>

              <button
                type="button"
                onClick={handleConfirmAndSchedule}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold rounded-lg shadow-sm transition-colors"
              >
                <Check className="w-4 h-4" />
                <span>Confirm & Add to Calendar</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
