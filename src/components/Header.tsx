import React from 'react';
import { User } from 'firebase/auth';
import { Calendar, Inbox, LogOut, Compass, RefreshCw, Mail } from 'lucide-react';

export type ActiveTab = 'calendar' | 'orders';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  user: User | null;
  onSignOut: () => void;
  newOrdersCount: number;
  busyDaysCount: number;
  onSyncGmail: () => void;
  isSyncingGmail: boolean;
  hasGmailAccess: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  user,
  onSignOut,
  newOrdersCount,
  onSyncGmail,
  isSyncingGmail,
  hasGmailAccess,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#0B0F17]/95 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
        
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <span className="text-base font-bold text-white tracking-tight">GuideOps</span>
            <span className="hidden sm:inline-block ml-2 px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 rounded">
              Guide Portal
            </span>
          </div>
        </div>

        {/* Zone 2: Navigation Tabs (Calendar & Orders) */}
        <nav className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              activeTab === 'calendar'
                ? 'bg-slate-800 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Calendar className="w-4 h-4 text-emerald-400" />
            <span>Calendar</span>
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors relative ${
              activeTab === 'orders'
                ? 'bg-slate-800 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Inbox className="w-4 h-4 text-cyan-400" />
            <span>Orders</span>
            {newOrdersCount > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-500 text-slate-950 text-[10px] font-bold rounded-full">
                {newOrdersCount}
              </span>
            )}
          </button>
        </nav>

        {/* Zone 3: Gmail Sync & Profile */}
        <div className="flex items-center gap-3 shrink-0">
          {hasGmailAccess && (
            <button
              onClick={onSyncGmail}
              disabled={isSyncingGmail}
              title="Sync incoming booking requests from Gmail"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isSyncingGmail ? 'animate-spin' : ''}`} />
              <span>{isSyncingGmail ? 'Scanning...' : 'Sync Gmail'}</span>
            </button>
          )}

          {user && (
            <div className="flex items-center gap-2.5 pl-2 border-l border-slate-800">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Guide'}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-full border border-slate-700 object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-emerald-950 text-emerald-400 flex items-center justify-center text-xs font-bold font-mono">
                  {(user.displayName || user.email || 'G')[0].toUpperCase()}
                </div>
              )}

              <div className="hidden lg:block text-left">
                <div className="text-xs font-semibold text-white leading-tight">
                  {user.displayName || 'Tour Guide'}
                </div>
                <div className="text-[10px] text-slate-400 leading-tight truncate max-w-[140px]">
                  {user.email}
                </div>
              </div>

              <button
                onClick={onSignOut}
                title="Sign Out"
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  );
};
