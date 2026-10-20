import React, { useState, useEffect } from 'react';
import { Tour, BookingSource } from '../types';
import { Calendar, Clock, MapPin, User as UserIcon, Tag, Globe, X, Check } from 'lucide-react';

interface TourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveTour: (tour: Tour, previousDate?: string) => void;
  initialTour?: Partial<Tour> | null;
  selectedDate?: string;
  guideId: string;
}

const BOOKING_SOURCES: BookingSource[] = [
  'TourHQ',
  'Viator',
  'GetYourGuide',
  'Airbnb',
  'Direct Email',
  'Referral',
  'Manual / Walk-in',
  'Other',
];

export const TourModal: React.FC<TourModalProps> = ({
  isOpen,
  onClose,
  onSaveTour,
  initialTour,
  selectedDate,
  guideId,
}) => {
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00 - 13:00');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [groupSize, setGroupSize] = useState(2);
  const [reason, setReason] = useState('Full Day Historical & Cultural Walking Tour');
  const [bookingSource, setBookingSource] = useState<BookingSource>('TourHQ');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (initialTour) {
      setDestination(initialTour.destination || '');
      setDate(initialTour.date || selectedDate || new Date().toISOString().split('T')[0]);
      setTime(initialTour.time || '09:00 - 13:00');
      setClientName(initialTour.clientName || '');
      setClientEmail(initialTour.clientEmail || '');
      setClientPhone(initialTour.clientPhone || '');
      setGroupSize(initialTour.groupSize || 2);
      setReason(initialTour.reason || 'Historical Walking Tour');
      setBookingSource((initialTour.bookingSource as BookingSource) || 'TourHQ');
      setNotes(initialTour.notes || '');
    } else {
      setDestination('');
      setDate(selectedDate || new Date().toISOString().split('T')[0]);
      setTime('09:00 - 13:00');
      setClientName('');
      setClientEmail('');
      setClientPhone('');
      setGroupSize(2);
      setReason('Historical Walking Tour');
      setBookingSource('TourHQ');
      setNotes('');
    }
  }, [initialTour, selectedDate, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination.trim() || !clientName.trim() || !date) return;

    const previousDate = initialTour?.date && initialTour.date !== date ? initialTour.date : undefined;

    const tour: Tour = {
      id: initialTour?.id || `tour-${Date.now()}`,
      guideId,
      destination: destination.trim(),
      date,
      time: time.trim(),
      clientName: clientName.trim(),
      clientEmail: clientEmail.trim() || undefined,
      clientPhone: clientPhone.trim() || undefined,
      groupSize: Number(groupSize) || 1,
      reason: reason.trim(),
      bookingSource,
      status: initialTour?.status || 'confirmed',
      notes: notes.trim() || undefined,
      orderId: initialTour?.orderId,
      createdAt: initialTour?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSaveTour(tour, previousDate);
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

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              {initialTour?.id ? 'Edit Scheduled Tour' : 'Schedule Confirmed Tour'}
            </h3>
            <p className="text-xs text-slate-400">
              Record destination, date, client details, and booking source
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Destination */}
          <div>
            <label className="block text-slate-300 font-medium mb-1">
              Destination / Tour Route *
            </label>
            <input
              type="text"
              required
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g. Samarkand Registan, Gur-e-Amir & Shah-i-Zinda"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Tour Date *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Time / Duration
              </label>
              <input
                type="text"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder="e.g. 09:30 - 14:00"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          {/* Client Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Lead Client Name *
              </label>
              <input
                type="text"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Alexander Wright"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Group Size (Guests)
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={groupSize}
                onChange={(e) => setGroupSize(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Client Email
              </label>
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="client@example.com"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Client Phone / WhatsApp
              </label>
              <input
                type="tel"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="+998 90 123 4567"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          {/* Booking Source & Reason / Tour Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Booking Source *
              </label>
              <select
                value={bookingSource}
                onChange={(e) => setBookingSource(e.target.value as BookingSource)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 transition-colors"
              >
                {BOOKING_SOURCES.map((src) => (
                  <option key={src} value={src}>
                    {src}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Tour Reason / Type
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Private Architecture Tour"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-slate-300 font-medium mb-1">
              Meeting Point & Special Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Meet in hotel lobby. Client requested English speaking guide and vegetarian lunch spot..."
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-semibold rounded-lg shadow-sm transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>Save & Update Calendar</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
