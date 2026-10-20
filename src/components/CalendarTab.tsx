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
  Tag
} from 'lucide-react';

interface CalendarTabProps {
  tours: Tour[];
  busyDates: BusyDateMap;
  onToggleDate: (dateStr: string) => void;
  onOpenAddTour: (defaultDate?: string) => void;
  onEditTour: (tour: Tour) => void;
  onDeleteTour: (tour: Tour) => void;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const CalendarTab: React.FC<CalendarTabProps> = ({
  tours,
  busyDates,
  onToggleDate,
  onOpenAddTour,
  onEditTour,
  onDeleteTour,
}) => {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

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

  // Calendar days grid calculation
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
      prevDays.push({
        dateStr: prevDate.toISOString().split('T')[0],
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
      nextDays.push({
        dateStr: nextDate.toISOString().split('T')[0],
        dayNum: d,
        isCurrentMonth: false,
      });
    }

    return [...prevDays, ...currentDays, ...nextDays];
  }, [year, month]);

  // Stats for current month
  const monthStats = useMemo(() => {
    let toursCount = 0;
    let busyDaysCount = 0;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let d = 1; d <= daysInMonth; d++) {
      const mStr = String(month + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      const dateStr = `${year}-${mStr}-${dStr}`;
      if (toursByDate[dateStr]?.length) {
        toursCount += toursByDate[dateStr].length;
        busyDaysCount++;
      } else if (busyDates[dateStr]?.isBusy) {
        busyDaysCount++;
      }
    }

    return {
      toursCount,
      busyDaysCount,
      availableDaysCount: daysInMonth - busyDaysCount,
    };
  }, [year, month, toursByDate, busyDates]);

  // Selected date tours
  const selectedDateTours = toursByDate[selectedDate] || [];
  const selectedDateBusy = busyDates[selectedDate];

  return (
    <div className="space-y-6">
      
      {/* Top Header & Action Strip */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Month Navigation */}
        <div className="flex items-center gap-3">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            {monthName} <span className="font-mono text-slate-400 font-normal">{year}</span>
          </h2>

          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-2.5 py-1 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-md border border-slate-700 transition-colors"
          >
            Today
          </button>
        </div>

        {/* Month Summary + Add Tour CTA */}
        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-4">
          
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              <span>{monthStats.toursCount} Confirmed Tours</span>
            </span>
            <span className="text-slate-600">·</span>
            <span className="flex items-center gap-1.5 text-amber-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              <span>{monthStats.busyDaysCount} Busy Days</span>
            </span>
            <span className="text-slate-600">·</span>
            <span className="flex items-center gap-1.5 text-slate-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-slate-700 inline-block" />
              <span>{monthStats.availableDaysCount} Available</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
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
              onClick={() => onOpenAddTour(selectedDate)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow-sm transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Tour</span>
            </button>
          </div>

        </div>

      </div>

      {/* Main Grid + Selected Day Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Calendar Grid (3 columns on large screens) */}
        <div className="lg:col-span-3 bg-[#111827] border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm space-y-2">
          
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-semibold text-slate-400">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Grid cells */}
          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((cell) => {
              const dayTours = toursByDate[cell.dateStr] || [];
              const hasTours = dayTours.length > 0;
              const isBusyDate = busyDates[cell.dateStr]?.isBusy;
              const isToday = cell.dateStr === todayStr;
              const isSelected = cell.dateStr === selectedDate;

              return (
                <div
                  key={cell.dateStr}
                  onClick={() => setSelectedDate(cell.dateStr)}
                  role="button"
                  tabIndex={0}
                  className={`min-h-[96px] sm:min-h-[115px] p-2 sm:p-2.5 rounded-xl border flex flex-col justify-between transition-all cursor-pointer select-none group relative ${
                    !cell.isCurrentMonth
                      ? 'bg-slate-950/20 border-slate-900/40 opacity-40 hover:opacity-75'
                      : hasTours
                      ? 'bg-emerald-950/25 border-emerald-500/50 hover:border-emerald-400 shadow-sm'
                      : isBusyDate
                      ? 'bg-amber-950/20 border-amber-500/40 hover:border-amber-400'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                  } ${
                    isSelected
                      ? 'ring-2 ring-emerald-400 shadow-md ring-offset-2 ring-offset-[#111827]'
                      : isToday
                      ? 'ring-1 ring-emerald-500/60'
                      : ''
                  }`}
                >
                  {/* Top Bar: Date number + Quick Toggle Button */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs sm:text-sm font-bold font-mono tabular-nums ${
                        isToday
                          ? 'text-emerald-400 font-extrabold'
                          : hasTours
                          ? 'text-emerald-300 font-bold'
                          : isBusyDate
                          ? 'text-amber-300 font-bold'
                          : cell.isCurrentMonth
                          ? 'text-slate-200'
                          : 'text-slate-600'
                      }`}
                    >
                      {cell.dayNum}
                    </span>

                    {/* Quick Toggle Busy/Available button on hover */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleDate(cell.dateStr);
                      }}
                      title={isBusyDate || hasTours ? 'Make Available' : 'Mark as Busy'}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-opacity text-[10px]"
                    >
                      {isBusyDate || hasTours ? 'Make Free' : 'Mark Busy'}
                    </button>
                  </div>

                  {/* Body / Badge area */}
                  <div className="mt-1 space-y-1">
                    {hasTours ? (
                      dayTours.map((t) => (
                        <div
                          key={t.id}
                          className="px-1.5 py-1 bg-emerald-500/15 border border-emerald-500/30 rounded text-[10px] text-emerald-300 leading-tight font-medium truncate"
                          title={`${t.destination} - ${t.clientName} (${t.bookingSource})`}
                        >
                          <div className="font-semibold truncate">{t.destination}</div>
                          <div className="text-[9px] text-emerald-400/80 truncate">
                            {t.clientName} · {t.bookingSource}
                          </div>
                        </div>
                      ))
                    ) : isBusyDate ? (
                      <div className="px-1.5 py-0.5 bg-amber-500/15 border border-amber-500/30 rounded text-[10px] text-amber-400 font-semibold truncate flex items-center gap-1">
                        <Briefcase className="w-2.5 h-2.5 shrink-0" />
                        <span>Busy</span>
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-600 group-hover:text-slate-400 transition-colors hidden sm:block">
                        Available
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Click any day to inspect details or schedule a tour.</span>
            <span className="font-mono">Hover a day to quickly toggle busy/free</span>
          </div>

        </div>

        {/* Selected Day Inspector Sidebar */}
        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 shadow-sm space-y-5 flex flex-col justify-between">
          
          <div className="space-y-4">
            {/* Selected Date Header */}
            <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Date Details
                </span>
                <h3 className="text-base font-bold text-white font-mono">{selectedDate}</h3>
              </div>

              <button
                type="button"
                onClick={() => onToggleDate(selectedDate)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  selectedDateBusy?.isBusy || selectedDateTours.length > 0
                    ? 'bg-amber-950/60 text-amber-400 border border-amber-800/60 hover:bg-amber-900/60'
                    : 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 hover:bg-emerald-900/60'
                }`}
              >
                {selectedDateBusy?.isBusy || selectedDateTours.length > 0 ? 'Busy (Click to Free)' : 'Available (Click to Block)'}
              </button>
            </div>

            {/* Tours on this day */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-white">
                  Tours on this Date ({selectedDateTours.length})
                </span>
                <button
                  onClick={() => onOpenAddTour(selectedDate)}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
                >
                  + Add Tour
                </button>
              </div>

              <div className="space-y-3">
                {selectedDateTours.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 space-y-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-bold text-white leading-snug">{t.destination}</div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => onEditTour(t)}
                          title="Edit Tour"
                          className="p-1 text-slate-400 hover:text-white rounded"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteTour(t)}
                          title="Delete Tour"
                          className="p-1 text-slate-400 hover:text-red-400 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1 text-slate-400 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>{t.time}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <UserIcon className="w-3 h-3 text-slate-500" />
                        <span className="text-slate-300 font-medium">{t.clientName}</span>
                        {t.groupSize && <span>({t.groupSize} guests)</span>}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Tag className="w-3 h-3 text-slate-500" />
                        <span>Source: </span>
                        <span className="text-emerald-400 font-semibold">{t.bookingSource}</span>
                      </div>
                    </div>

                    {t.reason && (
                      <div className="pt-1.5 border-t border-slate-800 text-[11px] text-slate-300">
                        <span className="text-slate-500">Reason: </span>
                        {t.reason}
                      </div>
                    )}
                  </div>
                ))}

                {selectedDateTours.length === 0 && (
                  <div className="p-6 text-center text-xs text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800">
                    No confirmed tours scheduled for this date.
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Quick Add CTA */}
          <button
            onClick={() => onOpenAddTour(selectedDate)}
            className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold border border-slate-700 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Schedule Tour for {selectedDate}</span>
          </button>

        </div>

      </div>

    </div>
  );
};
