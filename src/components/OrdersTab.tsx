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
  Check
} from 'lucide-react';

interface OrdersTabProps {
  orders: Order[];
  onSyncGmail: () => void;
  isSyncingGmail: boolean;
  hasGmailAccess: boolean;
  onOpenConnectGmail: () => void;
  onAcceptOrder: (order: Order) => void;
  onRejectOrder: (order: Order) => void;
  onMarkProcessed: (order: Order) => void;
  onConfirmToCalendar: (order: Order) => void;
  onReviewOrder: (order: Order) => void;
  onAddManualOrder: () => void;
  onLoadDemoOrders: () => void;
  syncReport?: string | null;
}

export const OrdersTab: React.FC<OrdersTabProps> = ({
  orders,
  onSyncGmail,
  isSyncingGmail,
  hasGmailAccess,
  onOpenConnectGmail,
  onAcceptOrder,
  onRejectOrder,
  onMarkProcessed,
  onConfirmToCalendar,
  onReviewOrder,
  onAddManualOrder,
  onLoadDemoOrders,
  syncReport,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'accepted' | 'confirmed' | 'processed'>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (platformFilter !== 'all' && o.platform !== platformFilter) return false;
      return true;
    });
  }, [orders, statusFilter, platformFilter]);

  const newOrdersCount = orders.filter((o) => o.status === 'new').length;

  const getPlatformBadge = (platform: string) => {
    switch (platform) {
      case 'TourHQ':
        return 'bg-amber-500/15 text-amber-400 border border-amber-500/30';
      case 'Viator':
        return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
      case 'GetYourGuide':
        return 'bg-orange-500/15 text-orange-400 border border-orange-500/30';
      case 'Airbnb':
        return 'bg-rose-500/15 text-rose-400 border border-rose-500/30';
      case 'Direct Email':
        return 'bg-blue-500/15 text-blue-400 border border-blue-500/30';
      default:
        return 'bg-slate-800 text-slate-300 border border-slate-700';
    }
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'new':
        return 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse';
      case 'confirmed':
        return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
      case 'accepted':
        return 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40';
      case 'processed':
        return 'bg-slate-800 text-slate-400 border border-slate-700';
      case 'rejected':
        return 'bg-red-500/20 text-red-400 border border-red-500/40';
      default:
        return 'bg-slate-800 text-slate-400';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Actions */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Tour Orders & Booking Requests
            </h2>
            {newOrdersCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-bold bg-amber-400 text-slate-950 rounded-full">
                {newOrdersCount} New
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Automatically detect and extract booking inquiries from TourHQ, Viator, and incoming Gmail messages.
          </p>
        </div>

        {/* Sync & Add Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {hasGmailAccess ? (
            <button
              onClick={onSyncGmail}
              disabled={isSyncingGmail}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingGmail ? 'animate-spin' : ''}`} />
              <span>{isSyncingGmail ? 'Scanning Gmail...' : 'Sync Gmail Inquiries'}</span>
            </button>
          ) : (
            <button
              onClick={onOpenConnectGmail}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
            >
              <Mail className="w-3.5 h-3.5 text-cyan-400" />
              <span>Connect Gmail</span>
            </button>
          )}

          <button
            onClick={onAddManualOrder}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Order</span>
          </button>

          {orders.length === 0 && (
            <button
              onClick={onLoadDemoOrders}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 text-xs font-medium rounded-lg border border-amber-800/60 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Load TourHQ Samples</span>
            </button>
          )}
        </div>

      </div>

      {/* Sync Status Banner */}
      {syncReport && (
        <div className="p-3 bg-cyan-950/30 border border-cyan-800/50 rounded-xl text-xs text-cyan-300 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>{syncReport}</span>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        
        {/* Status segmented buttons */}
        <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800">
          {(['all', 'new', 'accepted', 'confirmed', 'processed'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded text-xs font-medium capitalize transition-colors ${
                statusFilter === st
                  ? 'bg-slate-800 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {st === 'all' ? 'All Requests' : st}
            </button>
          ))}
        </div>

        {/* Platform filter */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Platform:</span>
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-md text-white text-xs focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Sources</option>
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
                  ? 'border-amber-500/40 shadow-amber-950/10'
                  : 'border-slate-800'
              }`}
            >
              {/* Card Top Row: Platform, Client, Date & Status */}
              <div className="flex flex-wrap items-start justify-between gap-4">
                
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${getPlatformBadge(order.platform)}`}>
                      {order.platform}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${getStatusBadge(order.status)}`}>
                      {order.status}
                    </span>
                    <span className="text-slate-500 text-[11px] font-mono">
                      {new Date(order.receivedAt || order.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white pt-1">
                    {order.destination}
                  </h3>
                </div>

                {/* Main Action Buttons */}
                <div className="flex items-center gap-2">
                  {order.status !== 'confirmed' && (
                    <button
                      onClick={() => onConfirmToCalendar(order)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-bold rounded-lg shadow-sm transition-colors whitespace-nowrap"
                    >
                      <Calendar className="w-3.5 h-3.5" />
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
                      title="Reject request"
                      className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    onClick={() => onReviewOrder(order)}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition-colors"
                  >
                    Edit / Review
                  </button>
                </div>

              </div>

              {/* Meta Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4 py-3 px-3.5 bg-slate-900/60 rounded-xl border border-slate-800/80 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Client:</span>
                  <span className="font-semibold text-white truncate">{order.clientName}</span>
                </div>

                <div className="flex items-center gap-2 font-mono">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-slate-400">Date:</span>
                  <span className="text-white font-medium">{order.requestedDate}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="text-slate-400">Party Size:</span>
                  <span className="text-white font-semibold">{order.groupSize} guests</span>
                </div>
              </div>

              {/* Client Message Snippet & Accordion */}
              <div className="text-xs space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="font-semibold text-[11px] uppercase tracking-wider text-slate-500">
                    Traveler Inquiry
                  </span>
                  <button
                    onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                  >
                    <span>{isExpanded ? 'Collapse' : 'Read Full Message'}</span>
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>

                <p className={`text-slate-300 leading-relaxed bg-slate-900/30 p-2.5 rounded-lg border border-slate-800/60 ${
                  isExpanded ? 'whitespace-pre-line' : 'line-clamp-2'
                }`}>
                  {order.message || 'No additional message provided.'}
                </p>

                {isExpanded && (
                  <div className="pt-2 flex flex-wrap items-center gap-4 text-slate-400 text-[11px]">
                    {order.clientEmail && (
                      <div className="flex items-center gap-1 text-slate-300">
                        <Mail className="w-3 h-3 text-slate-500" />
                        <span>{order.clientEmail}</span>
                      </div>
                    )}
                    {order.clientPhone && (
                      <div className="flex items-center gap-1 text-slate-300">
                        <Phone className="w-3 h-3 text-slate-500" />
                        <span>{order.clientPhone}</span>
                      </div>
                    )}
                    {order.calendarTourId && (
                      <div className="flex items-center gap-1 text-emerald-400 font-semibold">
                        <Check className="w-3 h-3" />
                        <span>Added to Calendar</span>
                      </div>
                    )}
                    <button
                      onClick={() => onMarkProcessed(order)}
                      className="ml-auto text-slate-400 hover:text-white"
                    >
                      Mark as Processed
                    </button>
                  </div>
                )}
              </div>

            </div>
          );
        })}

        {filteredOrders.length === 0 && (
          <div className="p-12 text-center text-xs text-slate-400 bg-[#111827] border border-slate-800 rounded-2xl space-y-4">
            <Inbox className="w-10 h-10 text-slate-600 mx-auto" />
            <div className="space-y-1">
              <h4 className="text-white font-bold text-sm">No Booking Orders Found</h4>
              <p className="text-slate-500 max-w-sm mx-auto">
                Sync with your Gmail account to scan incoming emails from TourHQ, Viator, and travelers, or create an order manually.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              {hasGmailAccess ? (
                <button
                  onClick={onSyncGmail}
                  disabled={isSyncingGmail}
                  className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg shadow-sm transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingGmail ? 'animate-spin' : ''}`} />
                  <span>Scan Gmail Now</span>
                </button>
              ) : (
                <button
                  onClick={onOpenConnectGmail}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg border border-slate-700 transition-colors"
                >
                  <Mail className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Connect Gmail Account</span>
                </button>
              )}

              <button
                onClick={onLoadDemoOrders}
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
