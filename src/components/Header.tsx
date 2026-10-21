import React from 'react';
import { User } from 'firebase/auth';
import { Calendar, Inbox, LogOut, RefreshCw } from 'lucide-react';

export type ActiveTab = 'calendar' | 'orders';
interface HeaderProps {
  activeTab: ActiveTab; setActiveTab: (tab: ActiveTab) => void; user: User | null;
  onSignOut: () => void; newOrdersCount: number; busyDaysCount: number;
  onSyncGmail: () => void; onConnectGmail: () => void; isSyncingGmail: boolean; hasGmailAccess: boolean;
}
export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, user, onSignOut, newOrdersCount, onSyncGmail, onConnectGmail, isSyncingGmail, hasGmailAccess }) => (
  <header className="sticky top-0 z-40 bg-[#0B0F17]/95 backdrop-blur-md border-b border-slate-800">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
      <a href="/" aria-label="Guide home" className="flex items-center gap-3 shrink-0">
        <img src="/guide-logo.svg" alt="" className="w-9 h-9 rounded-lg object-cover" />
        <div className="flex flex-col leading-none">
          <span className="text-lg font-normal tracking-[0.18em] text-white" style={{fontFamily:'"Instrument Serif", Georgia, serif'}}>GUIDE</span>
          <span className="mt-1 text-[9px] uppercase tracking-[0.22em] text-slate-400">Private tours</span>
        </div>
      </a>
      <nav className="flex items-center gap-1 sm:gap-2" aria-label="Main">
        <button onClick={() => setActiveTab('calendar')} aria-current={activeTab === 'calendar' ? 'page' : undefined} className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${activeTab === 'calendar' ? 'bg-slate-800 text-white font-semibold shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}>
          <Calendar className="w-4 h-4 text-slate-200" /><span>Calendar</span>
        </button>
        <button onClick={() => setActiveTab('orders')} aria-current={activeTab === 'orders' ? 'page' : undefined} className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors relative ${activeTab === 'orders' ? 'bg-slate-800 text-white font-semibold shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}>
          <Inbox className="w-4 h-4 text-slate-200" /><span>Orders</span>
          {newOrdersCount > 0 && <span className="px-1.5 py-0.5 bg-amber-500 text-slate-950 text-[10px] font-bold rounded-full" aria-label={`${newOrdersCount} new`}>{newOrdersCount}</span>}
        </button>
      </nav>
      <div className="flex items-center gap-3 shrink-0">
        <button onClick={hasGmailAccess ? onSyncGmail : onConnectGmail} disabled={isSyncingGmail} title={hasGmailAccess ? "Sync booking inquiries from Gmail" : "Connect Gmail and grant read-only access"} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-100 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-colors disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 text-slate-300 ${isSyncingGmail ? 'animate-spin' : ''}`} /><span>{isSyncingGmail ? 'Scanning...' : hasGmailAccess ? 'Sync Gmail' : 'Connect Gmail'}</span>
        </button>
        {user && <div className="flex items-center gap-2.5 pl-2 border-l border-slate-800">
          {user.photoURL ? <img src={user.photoURL} alt={user.displayName || 'Guide'} referrerPolicy="no-referrer" className="w-8 h-8 rounded-full border border-slate-700 object-cover" /> : <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-950 flex items-center justify-center text-xs font-bold font-mono">{(user.displayName || user.email || 'G')[0].toUpperCase()}</div>}
          <div className="hidden lg:block text-left"><div className="text-xs font-semibold text-white leading-tight">{user.displayName || 'Tour Guide'}</div><div className="text-[10px] text-slate-400 leading-tight truncate max-w-[140px]">{user.email}</div></div>
          <button onClick={onSignOut} title="Sign Out" aria-label="Sign out" className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"><LogOut className="w-4 h-4" /></button>
        </div>}
      </div>
    </div>
  </header>
);
