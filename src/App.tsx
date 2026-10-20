import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  subscribeToGuideBusyDates,
  toggleGuideDate,
  getAccessToken
} from './lib/firebase';
import { fetchBookingOrdersFromGmail, generateSamplePlatformOrders } from './lib/gmail';
import { Tour, Order, BusyDateMap } from './types';
import { Header, ActiveTab } from './components/Header';
import { CalendarTab } from './components/CalendarTab';
import { OrdersTab } from './components/OrdersTab';
import { TourModal } from './components/TourModal';
import { OrderReviewModal } from './components/OrderReviewModal';
import { Loader2, Calendar as CalendarIcon, CheckCircle2, AlertCircle } from 'lucide-react';

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
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Modals
  const [isTourModalOpen, setIsTourModalOpen] = useState(false);
  const [selectedTourForEdit, setSelectedTourForEdit] = useState<Tour | null>(null);
  const [defaultTourDate, setDefaultTourDate] = useState<string | undefined>(undefined);

  const [isOrderReviewModalOpen, setIsOrderReviewModalOpen] = useState(false);
  const [selectedOrderForReview, setSelectedOrderForReview] = useState<Order | null>(null);

  // Show Toast
  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4500);
  };

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

  // Listen to Firestore for current Guide's data
  useEffect(() => {
    if (!user) return;

    const unsubTours = subscribeToGuideTours(user.uid, (remoteTours) => {
      setTours(remoteTours);
    });

    const unsubOrders = subscribeToGuideOrders(user.uid, (remoteOrders) => {
      setOrders(remoteOrders);
    });

    const unsubBusyDates = subscribeToGuideBusyDates(user.uid, (remoteDates) => {
      setBusyDates(remoteDates);
    });

    return () => {
      unsubTours();
      unsubOrders();
      unsubBusyDates();
    };
  }, [user]);

  // Derived counts
  const newOrdersCount = useMemo(() => {
    return orders.filter(o => o.status === 'new').length;
  }, [orders]);

  const busyDaysCount = useMemo(() => {
    return Object.keys(busyDates).length;
  }, [busyDates]);

  // Existing message IDs to prevent duplicates
  const existingMessageIds = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => {
      if (o.emailMessageId) set.add(o.emailMessageId);
    });
    return set;
  }, [orders]);

  // Handlers
  const handleToggleDate = async (dateStr: string) => {
    if (!user) return;
    const current = busyDates[dateStr];
    try {
      await toggleGuideDate(user.uid, dateStr, current);
      showToast(current?.isBusy ? `Date ${dateStr} is now Available.` : `Date ${dateStr} marked as Busy.`);
    } catch (err: any) {
      showToast(err.message || 'Error updating date.', 'error');
    }
  };

  const handleSaveTour = async (tour: Tour) => {
    if (!user) return;
    try {
      await saveGuideTour(user.uid, tour);
      showToast(`Tour to "${tour.destination}" scheduled for ${tour.date}!`);
    } catch (err: any) {
      showToast(err.message || 'Failed to save tour.', 'error');
    }
  };

  const handleDeleteTour = async (tour: Tour) => {
    if (!user) return;
    if (!confirm(`Are you sure you want to cancel and remove the tour for ${tour.clientName}?`)) return;
    try {
      await deleteGuideTour(user.uid, tour);
      showToast(`Tour on ${tour.date} removed.`);
    } catch (err: any) {
      showToast(err.message || 'Failed to delete tour.', 'error');
    }
  };

  // Confirm order to calendar
  const handleConfirmOrderToCalendar = async (order: Order, tourTime: string, reason: string) => {
    if (!user) return;

    const tourId = `tour-from-order-${Date.now()}`;
    const newTour: Tour = {
      id: tourId,
      guideId: user.uid,
      destination: order.destination,
      date: order.requestedDate,
      time: tourTime || '09:30 - 14:00',
      clientName: order.clientName,
      clientEmail: order.clientEmail,
      clientPhone: order.clientPhone,
      groupSize: order.groupSize,
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

      // 2. Update Order status
      await updateOrderStatus(user.uid, order.id, 'confirmed', tourId);

      showToast(`Order confirmed! Added tour to Calendar on ${order.requestedDate}.`);
      setActiveTab('calendar');
    } catch (err: any) {
      showToast(err.message || 'Failed to add tour to calendar.', 'error');
    }
  };

  // Sync with Gmail
  const handleSyncGmail = async () => {
    if (!user) return;

    const token = accessToken || (await getAccessToken());
    if (!token) {
      showToast('Please sign in with Google to allow Gmail scanning.', 'info');
      try {
        await signInGuide();
      } catch (e) {
        return;
      }
    }

    const currentToken = accessToken || (await getAccessToken());
    if (!currentToken) return;

    try {
      setIsSyncingGmail(true);
      setSyncReport(null);

      const result = await fetchBookingOrdersFromGmail(currentToken, user.uid, existingMessageIds);

      // Save extracted orders into Firestore
      for (const order of result.newOrders) {
        await saveGuideOrder(user.uid, order);
      }

      const report = `Scanned ${result.scannedCount} emails · Found ${result.newOrders.length} new booking requests · ${result.duplicateCount} already synced · ${result.rejectedCount} non-booking emails filtered.`;
      setSyncReport(report);
      showToast(result.newOrders.length > 0 ? `Synced ${result.newOrders.length} new tour requests from Gmail!` : 'Gmail checked. No new booking inquiries found.', 'info');
    } catch (err: any) {
      console.error('Gmail sync error:', err);
      showToast(err.message || 'Failed to scan Gmail inbox.', 'error');
    } finally {
      setIsSyncingGmail(false);
    }
  };

  // Load Sample Demo Orders (TourHQ, Viator, GetYourGuide)
  const handleLoadDemoOrders = async () => {
    if (!user) return;
    try {
      const demoOrders = generateSamplePlatformOrders(user.uid);
      for (const order of demoOrders) {
        await saveGuideOrder(user.uid, order);
      }
      showToast('Loaded 3 sample booking inquiries from TourHQ, Viator, and GetYourGuide!');
    } catch (err: any) {
      showToast('Failed to load sample bookings.', 'error');
    }
  };

  // Loading Screen
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400 text-sm">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
          <span>Loading Guide Tour Portal...</span>
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
              Manage your availability calendar and automatically detect incoming tour booking requests from TourHQ, Viator, and Gmail.
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={() => signInGuide()}
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
        onSyncGmail={handleSyncGmail}
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
            onToggleDate={handleToggleDate}
            onOpenAddTour={(date) => {
              setDefaultTourDate(date);
              setSelectedTourForEdit(null);
              setIsTourModalOpen(true);
            }}
            onEditTour={(tour) => {
              setSelectedTourForEdit(tour);
              setIsTourModalOpen(true);
            }}
            onDeleteTour={handleDeleteTour}
          />
        )}

        {/* Tab 2: Orders */}
        {activeTab === 'orders' && (
          <OrdersTab
            orders={orders}
            onSyncGmail={handleSyncGmail}
            isSyncingGmail={isSyncingGmail}
            hasGmailAccess={Boolean(accessToken)}
            onOpenConnectGmail={() => signInGuide()}
            onAcceptOrder={(order) => {
              updateOrderStatus(user.uid, order.id, 'accepted');
              showToast(`Order from ${order.clientName} marked as Accepted.`);
            }}
            onRejectOrder={(order) => {
              updateOrderStatus(user.uid, order.id, 'rejected');
              showToast(`Order from ${order.clientName} rejected.`);
            }}
            onMarkProcessed={(order) => {
              updateOrderStatus(user.uid, order.id, 'processed');
              showToast(`Order marked as Processed.`);
            }}
            onConfirmToCalendar={(order) => {
              setSelectedOrderForReview(order);
              setIsOrderReviewModalOpen(true);
            }}
            onReviewOrder={(order) => {
              setSelectedOrderForReview(order);
              setIsOrderReviewModalOpen(true);
            }}
            onAddManualOrder={() => {
              setSelectedOrderForReview(null);
              setIsOrderReviewModalOpen(true);
            }}
            onLoadDemoOrders={handleLoadDemoOrders}
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
        onSaveOnly={(order) => {
          saveGuideOrder(user.uid, order);
          showToast(`Order details updated.`);
        }}
        order={selectedOrderForReview}
        guideId={user.uid}
      />

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-slate-600 border-t border-slate-800/80">
        GuideOps · Professional Tour Calendar & Platform Order Management
      </footer>

    </div>
  );
}
