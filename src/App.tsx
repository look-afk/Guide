import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { User } from 'firebase/auth';
import { 
  initAuth, 
  signInGuide, 
  signOutGuide, 
  subscribeToGuideTours,
  saveGuideTour,
  deleteGuideTour,
  subscribeToGuideOrders,
  saveGuideOrder,
  updateOrderStatus,
  deleteGuideOrder,
  subscribeToGuideBusyDates,
  blockGuideDate,
  unblockGuideDate,
  blockGuideDateRange,
  unblockGuideDateRange,
  getAccessToken,
  clearAccessToken,
  connectGmail
} from './lib/firebase';
import { fetchBookingOrdersFromGmail, GmailAuthError } from './lib/gmail';
import { Tour, Order, BusyDateMap, OrderStatus } from './types';
import { Header, ActiveTab } from './components/Header';
import { CalendarTab } from './components/CalendarTab';
import { OrdersTab } from './components/OrdersTab';
import { TourModal } from './components/TourModal';
import { OrderReviewModal } from './components/OrderReviewModal';
import { DateRangeModal } from './components/DateRangeModal';
import { Loader2, Calendar as CalendarIcon, CheckCircle2, AlertCircle, Info } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('calendar');

  // Core Data Collections
  const [tours, setTours] = useState<Tour[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [busyDates, setBusyDates] = useState<BusyDateMap>({});

  // Syncing & Notifications
  const [isSyncingGmail, setIsSyncingGmail] = useState(false);
  const [syncReport, setSyncReport] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Modals
  const [isTourModalOpen, setIsTourModalOpen] = useState(false);
  const [selectedTourForEdit, setSelectedTourForEdit] = useState<Tour | null>(null);
  const [defaultTourDate, setDefaultTourDate] = useState<string | undefined>(undefined);

  const [isOrderReviewModalOpen, setIsOrderReviewModalOpen] = useState(false);
  const [selectedOrderForReview, setSelectedOrderForReview] = useState<Order | null>(null);

  const [isDateRangeModalOpen, setIsDateRangeModalOpen] = useState(false);
  const [defaultRangeStartDate, setDefaultRangeStartDate] = useState<string | undefined>(undefined);

  // Ref to prevent overlapping syncs
  const isSyncingRef = useRef(false);

  // Keep the toast timer in a ref so an older timer cannot hide a newer toast.
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Toast Notification
  const showToast = useCallback((text: string, type: 'success' | 'info' | 'error' = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage({ text, type });
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 4500);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const handleSignIn = useCallback(async () => {
    try {
      await signInGuide();
    } catch (err: any) {
      const code = err?.code as string | undefined;
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
      showToast(
        code === 'auth/popup-blocked'
          ? 'Your browser blocked the sign-in popup. Allow popups for this site and try again.'
          : err?.message || 'Sign-in failed. Please try again.',
        'error'
      );
    }
  }, [showToast]);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setAccessToken(token);
        setAuthLoading(false);
      },
      () => {
        setUser(null);
        setAccessToken(null);
        setTours([]);
        setOrders([]);
        setBusyDates({});
        setAuthLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Real-time Firestore Subscriptions
  useEffect(() => {
    if (!user) return;

    const onLoadError = () =>
      showToast('Could not load your data. Check your connection and permissions.', 'error');

    const unsubTours = subscribeToGuideTours(user.uid, (remoteTours) => {
      setTours(remoteTours);
    }, onLoadError);

    const unsubOrders = subscribeToGuideOrders(user.uid, (remoteOrders) => {
      setOrders(remoteOrders);
    }, onLoadError);

    const unsubBusyDates = subscribeToGuideBusyDates(user.uid, (remoteDates) => {
      setBusyDates(remoteDates);
    }, onLoadError);

    return () => {
      unsubTours();
      unsubOrders();
      unsubBusyDates();
    };
  }, [user, showToast]);

  // Derived counts
  const newOrdersCount = useMemo(() => {
    return orders.filter(o => o.status === 'new').length;
  }, [orders]);

  const busyDaysCount = useMemo(() => {
    return Object.keys(busyDates).length;
  }, [busyDates]);

  // Existing message IDs in Firestore to guarantee persistent deduplication
  const existingMessageIds = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => {
      if (o.emailMessageId) set.add(o.emailMessageId);
    });
    return set;
  }, [orders]);

  // Set of dates that have confirmed tours
  const datesWithConfirmedTours = useMemo(() => {
    const set = new Set<string>();
    tours.forEach(t => {
      if (t.date) set.add(t.date);
    });
    return set;
  }, [tours]);

  // ----------------- CALENDAR HANDLERS -----------------

  const handleSaveTour = async (tour: Tour, previousDate?: string) => {
    if (!user) return;
    try {
      await saveGuideTour(user.uid, tour, previousDate);
      showToast(`Tour to "${tour.destination}" scheduled for ${tour.date}!`);
    } catch (err: any) {
      showToast(err.message || 'Failed to save tour.', 'error');
    }
  };

  const handleDeleteTour = async (tour: Tour) => {
    if (!user) return;
    try {
      await deleteGuideTour(user.uid, tour);
      showToast(`Tour on ${tour.date} cancelled and removed.`);
    } catch (err: any) {
      showToast(err.message || 'Failed to delete tour.', 'error');
    }
  };

  // Quick single-date manual block with custom reason
  const handleQuickBlockWithReason = async (dateStr: string, reason: string) => {
    if (!user) return;
    try {
      await blockGuideDate(user.uid, dateStr, reason);
      showToast(`Date ${dateStr} marked as Busy.`);
    } catch (err: any) {
      showToast(err.message || 'Failed to block date.', 'error');
    }
  };

  // Quick single-date manual unblock
  const handleQuickUnblockDate = async (dateStr: string) => {
    if (!user) return;
    if (datesWithConfirmedTours.has(dateStr)) {
      showToast(`Date ${dateStr} has confirmed tour(s). Cancel or edit the scheduled tour to free this date.`, 'info');
      return;
    }
    try {
      await unblockGuideDate(user.uid, dateStr);
      showToast(`Date ${dateStr} is now Available.`);
    } catch (err: any) {
      showToast(err.message || 'Failed to unblock date.', 'error');
    }
  };

  // Block multiple consecutive days (Date Range)
  const handleBlockDateRange = async (startDate: string, endDate: string, reason: string) => {
    if (!user) return;
    try {
      const count = await blockGuideDateRange(user.uid, startDate, endDate, reason);
      showToast(`Marked ${count} days as Busy (${startDate} to ${endDate}).`);
    } catch (err: any) {
      showToast(err.message || 'Failed to block date range.', 'error');
    }
  };

  // Unblock multiple consecutive days
  const handleUnblockDateRange = async (startDate: string, endDate: string) => {
    if (!user) return;
    try {
      const { unblockedCount, protectedTourDates } = await unblockGuideDateRange(user.uid, startDate, endDate);
      if (protectedTourDates.length > 0) {
        showToast(
          `Freed ${unblockedCount} dates. ${protectedTourDates.length} date(s) remained protected due to scheduled tours.`,
          'info'
        );
      } else {
        showToast(`Freed ${unblockedCount} days (${startDate} to ${endDate}).`);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to unblock date range.', 'error');
    }
  };

  // ----------------- ORDERS HANDLERS -----------------

  const handleMarkReviewed = async (order: Order) => {
    if (!user) return;
    try {
      await updateOrderStatus(user.uid, order.id, 'reviewed');
      showToast(`Inquiry from ${order.clientName || 'Traveler'} marked as Reviewed.`);
    } catch (err: any) {
      showToast(err.message || 'Failed to update order.', 'error');
    }
  };

  const handleDeclineOrder = async (order: Order) => {
    if (!user) return;
    try {
      await updateOrderStatus(user.uid, order.id, 'declined');
      showToast(`Inquiry from ${order.clientName || 'Traveler'} marked as Declined.`);
    } catch (err: any) {
      showToast(err.message || 'Failed to decline order.', 'error');
    }
  };

  const handleSaveOrderStatus = async (orderId: string, status: OrderStatus, updatedFields?: Partial<Order>) => {
    if (!user) return;
    try {
      await updateOrderStatus(user.uid, orderId, status);
      if (updatedFields && Object.keys(updatedFields).length > 0) {
        const existing = orders.find(o => o.id === orderId);
        if (existing) {
          await saveGuideOrder(user.uid, {
            ...existing,
            ...updatedFields,
            status,
            updatedAt: new Date().toISOString()
          });
        }
      }
      showToast(`Inquiry status updated to ${status}.`);
    } catch (err: any) {
      showToast(err.message || 'Failed to update order.', 'error');
    }
  };

  const handleDeleteOrder = async (order: Order) => {
    if (!user) return;
    try {
      await deleteGuideOrder(user.uid, order.id);
      showToast('Booking inquiry record removed.');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete order.', 'error');
    }
  };

  // Confirm order and schedule to Calendar
  const handleConfirmOrderToCalendar = async (order: Order, tourTime: string, reason: string) => {
    if (!user) return;

    if (!order.requestedDate || !/^\d{4}-\d{2}-\d{2}$/.test(order.requestedDate)) {
      showToast('Please provide a valid confirmed date (YYYY-MM-DD) before scheduling.', 'error');
      return;
    }

    const tourId = order.calendarTourId || `tour-from-order-${order.id}`;
    const newTour: Tour = {
      id: tourId,
      guideId: user.uid,
      destination: order.destination || 'Private Guided Tour',
      date: order.requestedDate,
      time: tourTime || '09:30 - 14:00',
      clientName: order.clientName || 'Traveler',
      clientEmail: order.clientEmail,
      clientPhone: order.clientPhone,
      groupSize: order.groupSize || 2,
      reason: reason || `${order.platform} Guided Tour`,
      bookingSource: order.platform,
      status: 'confirmed',
      notes: order.message,
      orderId: order.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      // 1. Save Tour & mark calendar date as busy
      await saveGuideTour(user.uid, newTour);

      // 2. Update Order status to 'scheduled' and link calendarTourId
      await updateOrderStatus(user.uid, order.id, 'scheduled', tourId);

      showToast(`Confirmed! Tour recorded on Calendar for ${order.requestedDate}.`);
      setActiveTab('calendar');
    } catch (err: any) {
      showToast(err.message || 'Failed to add tour to calendar.', 'error');
    }
  };

  // ----------------- GMAIL INTEGRATION -----------------

  const executeGmailSync = useCallback(async (isManualTrigger: boolean = true) => {
    if (!user) return;
    if (isSyncingRef.current) return;

    let token = accessToken || (await getAccessToken());
    if (!token) {
      if (!isManualTrigger) return;
      showToast('Please sign in with Google to allow Gmail scanning.', 'info');
      try {
        // Use the fresh sign-in token and continue without requiring a second click.
        const result = await signInGuide();
        token = result?.accessToken || null;
      } catch {
        return;
      }
      if (!token) return;
      setAccessToken(token);
    }

    try {
      isSyncingRef.current = true;
      setIsSyncingGmail(true);

      const result = await fetchBookingOrdersFromGmail(token, user.uid, existingMessageIds);

      // Save extracted genuine orders into Firestore.
      for (const order of result.newOrders) {
        await saveGuideOrder(user.uid, order);
      }

      setLastSyncTime(new Date());

      const report = \`Scanned \${result.scannedCount} emails · Found \${result.newOrders.length} new booking inquiries · \${result.duplicateCount} already saved · \${result.rejectedCount} non-booking messages filtered.\`;
      setSyncReport(report);

      if (isManualTrigger) {
        showToast(
          result.newOrders.length > 0
            ? \`Synced \${result.newOrders.length} new booking inquiries from Gmail!\`
            : 'Gmail scan complete. No new booking inquiries found.',
          'info'
        );
      }
    } catch (err: any) {
      console.error('Gmail sync error:', err);
      if (err instanceof GmailAuthError) {
        // Clear expired tokens so the user can reconnect Gmail.
        clearAccessToken();
        setAccessToken(null);
        showToast(err.message, 'error');
      } else if (isManualTrigger) {
        showToast(err.message || 'Failed to scan Gmail inbox.', 'error');
      }
    } finally {
      setIsSyncingGmail(false);
      isSyncingRef.current = false;
    }
  }, [user, accessToken, existingMessageIds, showToast]);
  // Periodic email sync (every 3 minutes while app is open)
  useEffect(() => {
    if (!user || !accessToken) return;

    const initialTimer = setTimeout(() => {
      executeGmailSync(false);
    }, 4000);

    const interval = setInterval(() => {
      executeGmailSync(false);
    }, 180000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [user, accessToken, executeGmailSync]);

  // Loading Screen
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400 text-sm">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
          <span>Loading Guide Portal...</span>
        </div>
      </div>
    );
  }

  // Signed out view
  if (!user) {
    return (
      <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col justify-center items-center px-4">
        <div className="w-full max-w-md bg-[#111827] border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6 text-center">
          
          <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CalendarIcon className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">Guide Tour Management</h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              Your personal calendar for tracking tour availability and inspecting genuine booking inquiries from TourHQ, Viator, and Gmail.
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={handleSignIn}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white hover:bg-slate-100 text-slate-900 font-semibold text-sm rounded-xl transition-all shadow-md hover:shadow-lg"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Sign in with Google</span>
            </button>
          </div>

          <div className="pt-4 border-t border-slate-800 text-xs text-slate-500">
            Secure Google Sign-In with Calendar & Gmail booking permissions.
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      
      {/* Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onSignOut={() => signOutGuide()}
        newOrdersCount={newOrdersCount}
        busyDaysCount={busyDaysCount}
        onSyncGmail={() => executeGmailSync(true)}
        onConnectGmail={handleConnectGmail}
        isSyncingGmail={isSyncingGmail}
        hasGmailAccess={Boolean(accessToken)}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className={`px-4 py-3 rounded-xl shadow-2xl border text-xs font-medium flex items-center gap-2.5 ${
            toastMessage.type === 'error'
              ? 'bg-red-950/90 text-red-200 border-red-800/80'
              : toastMessage.type === 'info'
              ? 'bg-cyan-950/90 text-cyan-200 border-cyan-800/80'
              : 'bg-emerald-950/90 text-emerald-200 border-emerald-800/80'
          }`}>
            {toastMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-400" />
            ) : toastMessage.type === 'info' ? (
              <Info className="w-4 h-4 text-cyan-400" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Main View Port */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Tab 1: Calendar */}
        {activeTab === 'calendar' && (
          <CalendarTab
            tours={tours}
            busyDates={busyDates}
            onToggleDate={async (dateStr, hasTours) => {
              if (hasTours || datesWithConfirmedTours.has(dateStr)) {
                showToast(`Date ${dateStr} has confirmed tours scheduled. Edit or cancel the tour to unblock.`, 'info');
                return;
              }
              const current = busyDates[dateStr];
              if (current?.isBusy) {
                await handleQuickUnblockDate(dateStr);
              } else {
                await handleQuickBlockWithReason(dateStr, 'Manually Blocked Date');
              }
            }}
            onOpenAddTour={(date) => {
              setDefaultTourDate(date);
              setSelectedTourForEdit(null);
              setIsTourModalOpen(true);
            }}
            onOpenDateRangeModal={(date) => {
              setDefaultRangeStartDate(date);
              setIsDateRangeModalOpen(true);
            }}
            onEditTour={(tour) => {
              setSelectedTourForEdit(tour);
              setIsTourModalOpen(true);
            }}
            onDeleteTour={handleDeleteTour}
            onQuickBlockWithReason={handleQuickBlockWithReason}
            onQuickUnblockDate={handleQuickUnblockDate}
          />
        )}

        {/* Tab 2: Orders */}
        {activeTab === 'orders' && (
          <OrdersTab
            orders={orders}
            onSyncGmail={() => executeGmailSync(true)}
            isSyncingGmail={isSyncingGmail}
            hasGmailAccess={Boolean(accessToken)}
            userEmail={user.email}
            lastSyncTime={lastSyncTime}
            onOpenConnectGmail={handleConnectGmail}
            onMarkReviewed={handleMarkReviewed}
            onDeclineOrder={handleDeclineOrder}
            onConfirmToCalendar={(order) => {
              setSelectedOrderForReview(order);
              setIsOrderReviewModalOpen(true);
            }}
            onReviewOrder={(order) => {
              setSelectedOrderForReview(order);
              setIsOrderReviewModalOpen(true);
            }}
            onDeleteOrder={handleDeleteOrder}
            syncReport={syncReport}
          />
        )}

      </main>

      {/* Modals */}
      <TourModal
        isOpen={isTourModalOpen}
        onClose={() => {
          setIsTourModalOpen(false);
          setSelectedTourForEdit(null);
        }}
        onSaveTour={handleSaveTour}
        initialTour={selectedTourForEdit}
        selectedDate={defaultTourDate}
        guideId={user.uid}
      />

      <OrderReviewModal
        isOpen={isOrderReviewModalOpen}
        onClose={() => {
          setIsOrderReviewModalOpen(false);
          setSelectedOrderForReview(null);
        }}
        onConfirmToCalendar={handleConfirmOrderToCalendar}
        onSaveStatusOnly={handleSaveOrderStatus}
        order={selectedOrderForReview}
        guideId={user.uid}
      />

      <DateRangeModal
        isOpen={isDateRangeModalOpen}
        onClose={() => setIsDateRangeModalOpen(false)}
        initialStartDate={defaultRangeStartDate}
        onBlockRange={handleBlockDateRange}
        onUnblockRange={handleUnblockDateRange}
      />

      {/* Clean Footer */}
      <footer className="py-4 text-center text-xs text-slate-500 border-t border-slate-800/80 px-4">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Guide · Personal Tour Calendar & Platform Inquiry Management</span>
          <span className="text-[11px] text-slate-500">
            Real-time Gmail inquiry scanning · Firestore persistent
          </span>
        </div>
      </footer>

    </div>
  );
}
