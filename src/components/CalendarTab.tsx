import React, { useState, useMemo } from 'react';
import { Tour, BusyDateMap } from '../types';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  MapPin, 
  Clock, 
  User as UserIcon, 
  Users, 
  Briefcase, 
  Trash2, 
  Edit3, 
  Calendar as CalendarIcon,
  Tag,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Info,
  Mail,
  Phone,
  Layers,
  ArrowRight
} from 'lucide-react';

interface CalendarTabProps {
  tours: Tour[];
  busyDates: BusyDateMap;
  onToggleDate: (dateStr: string, hasTours: boolean) => void;
  onOpenAddTour: (defaultDate?: string) => void;
  onOpenDateRangeModal: (defaultStartDate?: string) => void;
  onEditTour: (tour: Tour) => void;
  onDeleteTour: (tour: Tour) => void;
  onQuickBlockWithReason: (dateStr: string, reason: string) => Promise<void>;
  onQuickUnblockDate: (dateStr: string) => Promise<void>;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const CalendarTab: React.FC<CalendarTabProps> = ({
  tours,
  busyDates,
  onOpenAddTour,
  onOpenDateRangeModal,
  onEditTour,
  onDeleteTour,
  onQuickBlockWithReason,
  onQuickUnblockDate,
}) => {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });

  // Tour deletion safety confirmation state
  const [tourToDelete, setTourToDelete] = useState<Tour | null>(null);

  // Quick single-date block inline editing
  const [isBlockingInline, setIsBlockingInline] = useState(false);
  const [inlineReason, setInlineReason] = useState('Private tour — Samarkand — unavailable for other bookings');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = useMemo(() => {
    return currentDate.toLocaleString('default', { month: 'long' });
  }, [currentDate]);

  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  // Map tours by date
  const toursByDate = useMemo(() => {
    const map: Record<string, Tour[]> = {};
    tours.forEach((tour) => {
      if (!map[tour.date]) map[tour.date] = [];
      map[tour.date].push(tour);
    });
    return map;
  }, [tours]);

  // Calendar days grid calculation (Monday start)
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    let startingDayOfWeek = firstDay.getDay() - 1;
    if (startingDayOfWeek === -1) startingDayOfWeek = 6;

    const daysInMonth = lastDay.getDate();
    const prevMonthLastDay = new Date(year, month, 0).getDate();

    const prevDays: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i;
      const prevDate = new Date(year, month - 1, d);
      const mStr = String(prevDate.getMonth() + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      prevDays.push({
        dateStr: `${prevDate.getFullYear()}-${mStr}-${dStr}`,
        dayNum: d,
        isCurrentMonth: false,
      });
    }

    const currentDays: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const mStr = String(month + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      currentDays.push({
        dateStr: `${year}-${mStr}-${dStr}`,
        dayNum: d,
        isCurrentMonth: true,
      });
    }

    const total = prevDays.length + currentDays.length;
    const remaining = total % 7 === 0 ? 0 : 7 - (total % 7);
    const nextDays: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(year, month + 1, d);
      const mStr = String(nextDate.getMonth() + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      nextDays.push({
        dateStr: `${nextDate.getFullYear()}-${mStr}-${dStr}`,
        dayNum: d,
        isCurrentMonth: false,
      });
    }

    return [...prevDays, ...currentDays, ...nextDays];
  }, [year, month]);

  // Selected date status
  const selectedDateTours = toursByDate[selectedDate] || [];
  const selectedDateBusy = busyDates[selectedDate];
  const selectedHasTours = selectedDateTours.length > 0;
  const selectedIsManuallyBlocked = !selectedHasTours && Boolean(selectedDateBusy?.isBusy);
  const selectedIsAvailable = !selectedHasTours && !selectedIsManuallyBlocked;

  // Human formatted selected date
  const formattedSelectedDate = useMemo(() => {
    try {
      const parts = selectedDate.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      }
      return selectedDate;
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  const getSourceBadgeColor = (source: string) => {
    switch (source) {
      case 'TourHQ':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'Viator':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case 'GetYourGuide':
        return 'bg-orange-500/15 text-orange-300 border-orange-500/30';
      case 'Airbnb':
        return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
      case 'Direct Email':
        return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const handleApplyInlineBlock = async () => {
    await onQuickBlockWithReason(selectedDate, inlineReason);
    setIsBlockingInline(false);
  };

  return (
    <div className="space-y-6">
      
      {/* Calendar Top Control Header */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Navigation: Month & Year */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {monthName}
            </h2>
            <span className="text-lg sm:text-xl font-mono text-slate-400 font-normal ml-1">
              {year}
            </span>
          </div>

          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5 ml-1">
            <button
              onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
              title="Previous Month"
              className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
              title="Next Month"
              className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => {
              const now = new Date();
              setCurrentDate(now);
              setSelectedDate(todayStr);
            }}
            className="px-2.5 py-1 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
          >
            Today
          </button>
        </div>

        {/* Action Controls: Add Tour & Block Date Range */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => onOpenDateRangeModal(selectedDate)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors whitespace-nowrap"
          >
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            <span>Block Date Range</span>
          </button>

          <button
            onClick={() => onOpenAddTour(selectedDate)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow-sm transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Record Tour</span>
          </button>
        </div>

      </div>

      {/* Main Layout: 7-Column Calendar Grid + Selected Date Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Calendar Grid (8 cols on desktop) */}
        <div className="lg:col-span-8 bg-[#111827] border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
          
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-1">
            {WEEKDAYS.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          {/* Grid cells */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {calendarDays.map((cell) => {
              const dayTours = toursByDate[cell.dateStr] || [];
              const hasTours = dayTours.length > 0;
              const isBusyDate = busyDates[cell.dateStr]?.isBusy;
              const isToday = cell.dateStr === todayStr;
              const isSelected = cell.dateStr === selectedDate;

              return (
                <div
                  key={cell.dateStr}
                  onClick={() => {
                    setSelectedDate(cell.dateStr);
                    setIsBlockingInline(false);
                  }}
                  role="button"
                  tabIndex={0}
                  className={`min-h-[105px] sm:min-h-[120px] p-2 rounded-xl border flex flex-col justify-between transition-all cursor-pointer select-none relative ${
                    !cell.isCurrentMonth
                      ? 'bg-slate-950/20 border-slate-900/50 opacity-40 hover:opacity-70'
                      : hasTours
                      ? 'bg-emerald-950/25 border-emerald-500/40 hover:border-emerald-400'
                      : isBusyDate
                      ? 'bg-amber-950/20 border-amber-500/40 hover:border-amber-400'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  } ${
                    isSelected
                      ? 'ring-2 ring-emerald-400 shadow-md ring-offset-2 ring-offset-[#111827]'
                      : isToday
                      ? 'ring-1 ring-emerald-500/60 border-emerald-500/40'
                      : ''
                  }`}
                >
                  {/* Top: Day Number + Status Flag */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs sm:text-sm font-mono tabular-nums leading-none ${
                        isToday
                          ? 'text-emerald-400 font-extrabold underline decoration-emerald-500 decoration-2 underline-offset-4'
                          : hasTours
                          ? 'text-emerald-300 font-bold'
                          : isBusyDate
                          ? 'text-amber-300 font-bold'
                          : cell.isCurrentMonth
                          ? 'text-slate-200 font-medium'
                          : 'text-slate-600'
                      }`}
                    >
                      {cell.dayNum}
                    </span>

                    {hasTours && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400" title="Confirmed tour scheduled" />
                    )}
                    {!hasTours && isBusyDate && (
                      <span className="w-2 h-2 rounded-full bg-amber-400" title="Manually blocked" />
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="mt-1 space-y-1 overflow-hidden">
                    {hasTours ? (
                      dayTours.slice(0, 2).map((t) => (
                        <div
                          key={t.id}
                          className="px-1.5 py-1 bg-emerald-500/15 border border-emerald-500/30 rounded text-[10px] text-emerald-300 leading-tight font-medium truncate"
                          title={`${t.destination} - ${t.clientName}`}
                        >
                          <div className="font-bold truncate text-[10px]">{t.destination}</div>
                          <div className="text-[9px] text-emerald-400/90 truncate">
                            {t.clientName}
                          </div>
                        </div>
                      ))
                    ) : isBusyDate ? (
                      <div className="px-1.5 py-1 bg-amber-500/15 border border-amber-500/30 rounded text-[10px] text-amber-300 font-medium truncate flex items-center gap-1">
                        <Briefcase className="w-2.5 h-2.5 shrink-0 text-amber-400" />
                        <span className="truncate">
                          {busyDates[cell.dateStr]?.reason || 'Busy'}
                        </span>
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-600 hidden sm:block">
                        Available
                      </div>
                    )}

                    {hasTours && dayTours.length > 2 && (
                      <div className="text-[9px] text-emerald-400 font-semibold text-right">
                        +{dayTours.length - 2} more
                      </div>
                    )}
                  </div>

                </div>
              );
            })}
          </div>

          {/* Legend Strip */}
          <div className="pt-2 text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
                <span className="text-slate-300 font-medium">Confirmed Tour</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                <span className="text-slate-300 font-medium">Manually Blocked</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-700 inline-block" />
                <span className="text-slate-400">Available</span>
              </span>
            </div>
            <span className="text-slate-500">
              Select any date to view tours or manage availability.
            </span>
          </div>

        </div>

        {/* Selected Date Inspector Panel (4 cols on desktop) */}
        <div className="lg:col-span-4 bg-[#111827] border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          
          {/* Inspector Header */}
          <div className="border-b border-slate-800 pb-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Date Inspector
              </span>
              <span className="text-xs font-mono font-semibold text-white bg-slate-900 px-2.5 py-0.5 rounded-md border border-slate-800">
                {selectedDate}
              </span>
            </div>
            <h3 className="text-base font-bold text-white leading-tight">
              {formattedSelectedDate}
            </h3>

            {/* Availability Status Badge & Direct Control */}
            <div className="pt-1">
              {selectedHasTours ? (
                <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs space-y-1">
                  <div className="flex items-center gap-2 font-bold text-emerald-400">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Confirmed Tour Date</span>
                  </div>
                  <p className="text-[11px] text-emerald-400/80 leading-relaxed">
                    {selectedDateTours.length} {selectedDateTours.length === 1 ? 'tour is' : 'tours are'} booked on this date.
                  </p>
                </div>
              ) : selectedIsManuallyBlocked ? (
                <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-300 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-amber-400">
                      <Briefcase className="w-4 h-4 shrink-0" />
                      <span>Manually Blocked</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onQuickUnblockDate(selectedDate)}
                      className="px-2.5 py-1 text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg shadow-sm transition-colors"
                    >
                      Make Available
                    </button>
                  </div>
                  {selectedDateBusy?.reason && (
                    <div className="text-[11px] text-amber-200/90 pt-1 border-t border-amber-800/40">
                      <span className="text-amber-400/80 font-medium">Reason: </span>
                      {selectedDateBusy.reason}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                      <span className="font-semibold text-white">Available for Bookings</span>
                    </div>
                    {!isBlockingInline && (
                      <button
                        type="button"
                        onClick={() => setIsBlockingInline(true)}
                        className="px-2.5 py-1 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
                      >
                        Block Date
                      </button>
                    )}
                  </div>

                  {isBlockingInline && (
                    <div className="pt-2 border-t border-slate-800 space-y-2">
                      <label className="block text-[11px] text-slate-400">Reason for blocking:</label>
                      <input
                        type="text"
                        value={inlineReason}
                        onChange={(e) => setInlineReason(e.target.value)}
                        placeholder="e.g. Private tour — Samarkand"
                        className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-amber-500"
                      />
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsBlockingInline(false)}
                          className="px-2 py-1 text-slate-400 hover:text-white text-xs"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleApplyInlineBlock}
                          className="px-3 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-lg"
                        >
                          Confirm Block
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>

          {/* Confirmed Tours List for this date */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <CalendarIcon className="w-3.5 h-3.5 text-emerald-400" />
                <span>Scheduled Tours ({selectedDateTours.length})</span>
              </span>
              
              <button
                onClick={() => onOpenAddTour(selectedDate)}
                className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Tour</span>
              </button>
            </div>

            {selectedDateTours.map((t) => (
              <div
                key={t.id}
                className="p-3.5 bg-slate-900/90 rounded-xl border border-slate-800 space-y-2.5 text-xs shadow-sm hover:border-slate-700 transition-colors"
              >
                {/* Title & Actions */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="font-bold text-white text-sm leading-snug">{t.destination}</div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getSourceBadgeColor(t.bookingSource)}`}>
                        {t.bookingSource}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 uppercase">
                        {t.status}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onEditTour(t)}
                      title="Edit Tour Details"
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setTourToDelete(t)}
                      title="Cancel and Remove Tour"
                      className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-1 gap-1.5 text-slate-300 text-xs bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="text-slate-400">Time:</span>
                    <span className="font-mono font-medium text-white">{t.time || '09:00 - 13:00'}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <UserIcon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="text-slate-400">Client:</span>
                    <span className="font-semibold text-white">{t.clientName}</span>
                    {t.groupSize && (
                      <span className="text-slate-400 font-normal">({t.groupSize} {t.groupSize === 1 ? 'guest' : 'guests'})</span>
                    )}
                  </div>

                  {t.clientEmail && (
                    <div className="flex items-center gap-2 text-[11px]">
                      <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="text-slate-400">Email:</span>
                      <a href={`mailto:${t.clientEmail}`} className="text-cyan-400 hover:underline truncate">
                        {t.clientEmail}
                      </a>
                    </div>
                  )}

                  {t.clientPhone && (
                    <div className="flex items-center gap-2 text-[11px]">
                      <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="text-slate-400">Phone:</span>
                      <span className="font-mono text-slate-200">{t.clientPhone}</span>
                    </div>
                  )}
                </div>

                {t.reason && (
                  <div className="text-[11px] text-slate-300">
                    <span className="text-slate-400 font-medium">Tour Type: </span>
                    <span className="text-white font-medium">{t.reason}</span>
                  </div>
                )}

                {t.notes && (
                  <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 leading-relaxed">
                    <span className="text-slate-500 font-semibold block mb-0.5">Special Notes:</span>
                    <p className="bg-slate-950/30 p-2 rounded border border-slate-800/60 text-slate-300">
                      {t.notes}
                    </p>
                  </div>
                )}

              </div>
            ))}

            {selectedDateTours.length === 0 && (
              <div className="p-5 text-center text-xs text-slate-400 bg-slate-900/40 rounded-xl border border-slate-800/80 space-y-1.5">
                <p className="font-medium text-slate-300">No tours scheduled on this date.</p>
                <p className="text-[11px] text-slate-500">
                  Use &ldquo;Record Tour&rdquo; to add a booking manually, or confirm an inquiry from Orders.
                </p>
              </div>
            )}
          </div>

          {/* Quick Schedule Tour CTA */}
          <button
            onClick={() => onOpenAddTour(selectedDate)}
            className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold border border-slate-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4 text-emerald-400 stroke-[2.5]" />
            <span>Record Tour on {selectedDate}</span>
          </button>

        </div>

      </div>

      {/* Safe Delete Confirmation Modal */}
      {tourToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#111827] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Cancel Confirmed Tour?</h4>
                <p className="text-xs text-slate-400">This action will remove the tour from your calendar.</p>
              </div>
            </div>

            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs space-y-1.5 text-slate-300">
              <div>
                <span className="text-slate-400">Destination: </span>
                <span className="font-bold text-white">{tourToDelete.destination}</span>
              </div>
              <div>
                <span className="text-slate-400">Client: </span>
                <span className="font-semibold text-white">{tourToDelete.clientName}</span>
              </div>
              <div>
                <span className="text-slate-400">Date: </span>
                <span className="font-mono text-emerald-400 font-semibold">{tourToDelete.date} ({tourToDelete.time})</span>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              If no other tours or manual blocks exist on {tourToDelete.date}, this date will automatically be marked as available.
            </p>

            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setTourToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
              >
                Keep Tour
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteTour(tourToDelete);
                  setTourToDelete(null);
                }}
                className="px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors shadow-sm"
              >
                Yes, Cancel & Delete Tour
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
