import React, { useState, useMemo } from 'react';
import { Order, OrderStatus } from '../types';
import { 
  Inbox, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Calendar, 
  Users, 
  MapPin, 
  Mail, 
  Phone, 
  MessageSquare, 
  Plus, 
  Sparkles, 
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Clock,
  Check,
  Trash2,
  AlertTriangle,
  ShieldCheck,
  Search,
  SlidersHorizontal,
  Info
} from 'lucide-react';

interface OrdersTabProps {
  orders: Order[];
  onSyncGmail: () => void;
  isSyncingGmail: boolean;
  hasGmailAccess: boolean;
  userEmail?: string | null;
  lastSyncTime?: Date | null;
  onOpenConnectGmail: () => void;
  onAcceptOrder: (order: Order) => void;
  onRejectOrder: (order: Order) => void;
  onMarkProcessed: (order: Order) => void;
  onConfirmToCalendar: (order: Order) => void;
  onReviewOrder: (order: Order) => void;
  onDeleteOrder: (order: Order) => void;
  onAddManualOrder: () => void;
  onLoadSandboxDemo: () => void;
  onClearDemoOrders: () => void;
  syncReport?: string | null;
}

export const OrdersTab: React.FC<OrdersTabProps> = ({
  orders,
  onSyncGmail,
  isSyncingGmail,
  hasGmailAccess,
  userEmail,
  lastSyncTime,
  onOpenConnectGmail,
  onAcceptOrder,
  onRejectOrder,
  onMarkProcessed,
  onConfirmToCalendar,
  onReviewOrder,
  onDeleteOrder,
  onAddManualOrder,
  onLoadSandboxDemo,
  onClearDemoOrders,
  syncReport,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'accepted' | 'confirmed' | 'processed'>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (platformFilter !== 'all' && o.platform !== platformFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = o.clientName.toLowerCase().includes(q);
        const matchDest = o.destination.toLowerCase().includes(q);
        const matchMsg = (o.message || '').toLowerCase().includes(q);
        const matchPlatform = o.platform.toLowerCase().includes(q);
        if (!matchName && !matchDest && !matchMsg && !matchPlatform) return false;
      }
      return true;
    });
  }, [orders, statusFilter, platformFilter, searchQuery]);

  const newOrdersCount = useMemo(() => {
    return orders.filter((o) => o.status === 'new').length;
  }, [orders]);

  const demoOrdersCount = useMemo(() => {
    return orders.filter((o) => o.isTestOrder).length;
  }, [orders]);

  const realOrdersCount = useMemo(() => {
    return orders.filter((o) => !o.isTestOrder).length;
  }, [orders]);

  // Format last sync time
  const formattedLastSync = useMemo(() => {
    if (!lastSyncTime) return 'Not synced yet this session';
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - lastSyncTime.getTime()) / 1000);
    if (diffSec < 45) return 'Just now';
    if (diffSec < 120) return '1 minute ago';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} minutes ago`;
    return lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [lastSyncTime]);

  const getPlatformBadge = (platform: string) => {
    switch (platform) {
      case 'TourHQ':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'Viator':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'GetYourGuide':
        return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
      case 'Airbnb':
        return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      case 'Direct Email':
        return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'new':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse';
      case 'confirmed':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'accepted':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
      case 'processed':
        return 'bg-slate-800 text-slate-400 border-slate-700';
      case 'rejected':
        return 'bg-red-500/20 text-red-400 border-red-500/40';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner: Status & Action Bar */}
      <div className="bg-[#111827] border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Tour Orders & Booking Inquiries
              </h2>
              {newOrdersCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-bold bg-amber-400 text-slate-950 rounded-full shadow-sm">
                  {newOrdersCount} New
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Real incoming booking requests from TourHQ, Viator, and private clients detected through Gmail.
            </p>
          </div>

          {/* Sync & Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            {hasGmailAccess ? (
              <button
                onClick={onSyncGmail}
                disabled={isSyncingGmail}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm transition-colors whitespace-nowrap"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingGmail ? 'animate-spin' : ''}`} />
                <span>{isSyncingGmail ? 'Scanning Gmail...' : 'Sync Gmail Now'}</span>
              </button>
            ) : (
              <button
                onClick={onOpenConnectGmail}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg border border-slate-700 transition-colors whitespace-nowrap"
              >
                <Mail className="w-3.5 h-3.5 text-cyan-400" />
                <span>Connect Gmail</span>
              </button>
            )}

            <button
              onClick={onAddManualOrder}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Order</span>
            </button>

            {demoOrdersCount > 0 && (
              <button
                onClick={onClearDemoOrders}
                title="Remove simulated test bookings from production"
                className="flex items-center gap-1 px-2.5 py-2 bg-slate-900 hover:bg-red-950/60 text-slate-400 hover:text-red-300 text-xs font-medium rounded-lg border border-slate-800 hover:border-red-800/60 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear Test Orders</span>
              </button>
            )}

            {orders.length === 0 && (
              <button
                onClick={onLoadSandboxDemo}
                className="flex items-center gap-1.5 px-3 py-2 bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 text-xs font-medium rounded-lg border border-amber-800/60 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Load TourHQ Samples</span>
              </button>
            )}
          </div>

        </div>

        {/* Connection & Periodic Sync Status Strip */}
        <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            {hasGmailAccess ? (
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold bg-emerald-950/40 px-2.5 py-1 rounded-md border border-emerald-800/40">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Gmail Connected ({userEmail || 'Active'})</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-amber-400 font-medium bg-amber-950/30 px-2 py-1 rounded-md border border-amber-800/30">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                <span>Gmail Not Connected</span>
              </span>
            )}

            <span className="text-slate-600">·</span>
            <span className="flex items-center gap-1 text-slate-400">
              <Clock className="w-3 h-3 text-slate-500" />
              <span>Last checked: {formattedLastSync}</span>
            </span>
          </div>

          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>Auto-sync checks every 3 minutes while app is open.</span>
          </div>
        </div>

      </div>

      {/* Sync Report Banner */}
      {syncReport && (
        <div className="p-3 bg-cyan-950/30 border border-cyan-800/50 rounded-xl text-xs text-cyan-300 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>{syncReport}</span>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-[#111827] border border-slate-800/90 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        
        {/* Status segmented buttons */}
        <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800 overflow-x-auto">
          {(['all', 'new', 'accepted', 'confirmed', 'processed'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded text-xs font-semibold capitalize transition-colors whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {st === 'all' ? 'All Requests' : st}
            </button>
          ))}
        </div>

        {/* Platform & Search */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search traveler, city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-44 sm:w-52"
            />
          </div>

          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Sources ({orders.length})</option>
            <option value="TourHQ">TourHQ</option>
            <option value="Viator">Viator</option>
            <option value="GetYourGuide">GetYourGuide</option>
            <option value="Airbnb">Airbnb</option>
            <option value="Direct Email">Direct Email</option>
          </select>
        </div>

      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders.map((order) => {
          const isExpanded = expandedOrderId === order.id;

          return (
            <div
              key={order.id}
              className={`bg-[#111827] border rounded-2xl p-5 transition-all shadow-sm ${
                order.status === 'new'
                  ? 'border-amber-500/50 shadow-amber-950/20'
                  : 'border-slate-800/90 hover:border-slate-700'
              }`}
            >
              {/* Card Top Row: Platform, Source Verification, Date & Actions */}
              <div className="flex flex-wrap items-start justify-between gap-4">
                
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Platform Badge */}
                    <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${getPlatformBadge(order.platform)}`}>
                      {order.platform}
                    </span>

                    {/* Status Badge */}
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getStatusBadge(order.status)}`}>
                      {order.status}
                    </span>

                    {/* Real vs Sandbox Tag */}
                    {order.isTestOrder ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/60 text-amber-400 border border-amber-800/60">
                        Sandbox Simulation
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-950/60 text-cyan-300 border border-cyan-800/60">
                        <ShieldCheck className="w-3 h-3 text-cyan-400" />
                        <span>Verified Gmail</span>
                      </span>
                    )}

                    <span className="text-slate-500 text-[11px] font-mono">
                      Received: {new Date(order.receivedAt || order.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Destination */}
                  <h3 className="text-base font-bold text-white pt-0.5">
                    {order.destination}
                  </h3>

                  {/* Sender & Subject Line if available */}
                  {(order.emailSender || order.emailSubject) && (
                    <div className="text-[11px] text-slate-400 space-y-0.5">
                      {order.emailSender && (
                        <div>
                          <span className="text-slate-500">From: </span>
                          <span className="font-mono text-slate-300">{order.emailSender}</span>
                        </div>
                      )}
                      {order.emailSubject && (
                        <div>
                          <span className="text-slate-500">Subject: </span>
                          <span className="text-slate-300 italic">{order.emailSubject}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Primary Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  {order.status !== 'confirmed' && (
                    <button
                      onClick={() => onConfirmToCalendar(order)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-bold rounded-lg shadow-sm transition-colors whitespace-nowrap"
                    >
                      <Calendar className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Add to Calendar</span>
                    </button>
                  )}

                  {order.status === 'new' && (
                    <button
                      onClick={() => onAcceptOrder(order)}
                      className="px-3 py-1.5 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-800/80 text-cyan-300 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
                    >
                      Accept
                    </button>
                  )}

                  {order.status === 'new' && (
                    <button
                      onClick={() => onRejectOrder(order)}
                      title="Decline / Reject request"
                      className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    onClick={() => onReviewOrder(order)}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors"
                  >
                    Edit / Review
                  </button>

                  <button
                    onClick={() => onDeleteOrder(order)}
                    title="Delete this order record"
                    className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>

              {/* Meta Data Box: Client, Date, Party Size */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4 py-3 px-3.5 bg-slate-900/70 rounded-xl border border-slate-800/80 text-xs">
                
                {/* Client info */}
                <div className="flex items-center gap-2 text-slate-300">
                  <span className="text-slate-500">Client:</span>
                  <span className="font-bold text-white truncate">{order.clientName}</span>
                </div>

                {/* Date verification */}
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-slate-500">Requested:</span>
                  {order.isDateConfirmed ? (
                    <span className="font-mono font-bold text-emerald-300 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800/50">
                      {order.requestedDate}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 font-semibold text-amber-300 bg-amber-950/50 px-2 py-0.5 rounded border border-amber-800/50">
                      <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                      <span>{order.requestedDate || 'Date Uncertain — Review'}</span>
                    </span>
                  )}
                </div>

                {/* Group size */}
                <div className="flex items-center gap-2 text-slate-300">
                  <Users className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="text-slate-500">Party Size:</span>
                  <span className="text-white font-bold">{order.groupSize} {order.groupSize === 1 ? 'guest' : 'guests'}</span>
                </div>

              </div>

              {/* Client Message / Accordion */}
              <div className="text-xs space-y-1.5">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="font-bold text-[11px] uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                    <span>Inquiry Message</span>
                  </span>
                  
                  <button
                    onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1"
                  >
                    <span>{isExpanded ? 'Collapse Message' : 'Read Full Message'}</span>
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>

                <p className={`text-slate-300 leading-relaxed bg-slate-900/40 p-3 rounded-xl border border-slate-800/70 ${
                  isExpanded ? 'whitespace-pre-line' : 'line-clamp-2'
                }`}>
                  {order.message || 'No additional message provided.'}
                </p>

                {isExpanded && (
                  <div className="pt-2 flex flex-wrap items-center gap-4 text-slate-400 text-[11px]">
                    {order.clientEmail && (
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <Mail className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-slate-500">Email:</span>
                        <a href={`mailto:${order.clientEmail}`} className="text-cyan-400 hover:underline">
                          {order.clientEmail}
                        </a>
                      </div>
                    )}
                    
                    {order.clientPhone && (
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <Phone className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-slate-500">Phone:</span>
                        <span className="font-mono text-slate-200">{order.clientPhone}</span>
                      </div>
                    )}

                    {order.calendarTourId && (
                      <div className="flex items-center gap-1 text-emerald-400 font-bold ml-auto">
                        <Check className="w-3.5 h-3.5" />
                        <span>Scheduled on Calendar</span>
                      </div>
                    )}

                    {order.status !== 'processed' && (
                      <button
                        onClick={() => onMarkProcessed(order)}
                        className="ml-auto text-slate-400 hover:text-white underline decoration-slate-600"
                      >
                        Mark as Processed
                      </button>
                    )}
                  </div>
                )}
              </div>

            </div>
          );
        })}

        {/* Empty State */}
        {filteredOrders.length === 0 && (
          <div className="p-12 text-center text-xs text-slate-400 bg-[#111827] border border-slate-800/90 rounded-2xl space-y-4 shadow-sm">
            <Inbox className="w-10 h-10 text-slate-600 mx-auto" />
            <div className="space-y-1">
              <h4 className="text-white font-bold text-sm">No Tour Orders Found</h4>
              <p className="text-slate-500 max-w-sm mx-auto">
                Scan your Gmail account for incoming TourHQ or Viator inquiries, or manually create an order.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {hasGmailAccess ? (
                <button
                  onClick={onSyncGmail}
                  disabled={isSyncingGmail}
                  className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg shadow-sm transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingGmail ? 'animate-spin' : ''}`} />
                  <span>Scan Gmail Now</span>
                </button>
              ) : (
                <button
                  onClick={onOpenConnectGmail}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg border border-slate-700 transition-colors"
                >
                  <Mail className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Connect Gmail Account</span>
                </button>
              )}

              <button
                onClick={onAddManualOrder}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg border border-slate-700 transition-colors"
              >
                + Add Manual Booking
              </button>

              <button
                onClick={onLoadSandboxDemo}
                className="px-4 py-2 bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 font-semibold rounded-lg border border-amber-800/60 transition-colors"
              >
                Load Sample TourHQ Bookings
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
