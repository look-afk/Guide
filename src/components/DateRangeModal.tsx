import React, { useState, useEffect, useMemo } from 'react';
import { X, Calendar, Briefcase, Check, AlertCircle } from 'lucide-react';
import { getDatesInRange } from '../lib/firebase';

interface DateRangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStartDate?: string;
  onBlockRange: (startDate: string, endDate: string, reason: string) => Promise<void>;
  onUnblockRange: (startDate: string, endDate: string) => Promise<void>;
}

export const DateRangeModal: React.FC<DateRangeModalProps> = ({
  isOpen,
  onClose,
  initialStartDate,
  onBlockRange,
  onUnblockRange,
}) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('Private tour — Samarkand — unavailable for other bookings');
  const [mode, setMode] = useState<'block' | 'unblock'>('block');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const s = initialStartDate || new Date().toISOString().split('T')[0];
      setStartDate(s);
      setEndDate(s);
      setReason('Private tour — Samarkand — unavailable for other bookings');
      setMode('block');
      setErrorMessage(null);
      setIsSubmitting(false);
    }
  }, [isOpen, initialStartDate]);

  const daysCount = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const dates = getDatesInRange(startDate, endDate);
    return dates.length;
  }, [startDate, endDate]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      setErrorMessage('Please select both a start date and an end date.');
      return;
    }

    if (startDate > endDate) {
      setErrorMessage('End date must be on or after start date.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      if (mode === 'block') {
        await onBlockRange(startDate, endDate, reason.trim());
      } else {
        await onUnblockRange(startDate, endDate);
      }
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update date range.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#111827] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Manage Date Range</h3>
              <p className="text-xs text-slate-400">Block or unblock multiple consecutive days at once</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Toggle */}
        <div className="grid grid-cols-2 p-1 bg-slate-900 rounded-xl border border-slate-800 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setMode('block')}
            className={`py-2 rounded-lg transition-colors ${
              mode === 'block'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Mark Period as Busy
          </button>
          <button
            type="button"
            onClick={() => setMode('unblock')}
            className={`py-2 rounded-lg transition-colors ${
              mode === 'unblock'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Make Period Available
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          {/* Start Date & End Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Start Date *</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (endDate < e.target.value) setEndDate(e.target.value);
                }}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">End Date *</label>
              <input
                type="date"
                required
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Days summary pill */}
          <div className="text-xs text-slate-400 flex items-center justify-between px-1">
            <span>Selected Duration:</span>
            <span className="font-bold text-white font-mono">
              {daysCount} {daysCount === 1 ? 'day' : 'consecutive days'}
            </span>
          </div>

          {/* Reason (only if blocking) */}
          {mode === 'block' && (
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Reason for Being Unavailable
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Private tour — Samarkand — unavailable for other bookings"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-amber-500 placeholder-slate-500"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Displayed when you inspect any date in this range.
              </span>
            </div>
          )}

          {mode === 'unblock' && (
            <p className="text-xs text-slate-400 bg-slate-900/50 p-3 rounded-xl border border-slate-800 leading-relaxed">
              Any date in this range that contains a confirmed scheduled tour will remain safely protected and will not be accidentally removed.
            </p>
          )}

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex items-center gap-1.5 px-4 py-2 font-bold rounded-lg transition-colors shadow-sm disabled:opacity-50 ${
                mode === 'block'
                  ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                  : 'bg-emerald-400 hover:bg-emerald-300 text-slate-950'
              }`}
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>
                {isSubmitting
                  ? 'Saving...'
                  : mode === 'block'
                  ? `Block ${daysCount} ${daysCount === 1 ? 'Day' : 'Days'}`
                  : `Free ${daysCount} ${daysCount === 1 ? 'Day' : 'Days'}`}
              </span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
