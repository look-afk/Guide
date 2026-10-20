import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User, 
  signOut 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  collection, 
  setDoc, 
  updateDoc,
  deleteDoc, 
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Tour, Order, BusyDateRecord, BusyDateMap, GuideProfile, OrderStatus } from '../types';

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore with specific databaseId
const firestoreDbId = (firebaseConfig as any).firestoreDatabaseId || 'ai-studio-9fbbd071-edf5-4f50-a0e3-73d8813d5494';
export const db = getFirestore(app, firestoreDbId);

// Initialize Auth
export const auth = getAuth(app);

// Google Auth Provider with Calendar and Gmail Readonly scopes
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/calendar.events');
googleProvider.addScope('https://www.googleapis.com/auth/gmail.readonly');

// In-memory token cache for Google Workspace APIs
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    }
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Auth Listeners & Actions
export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const signInGuide = async (): Promise<{ user: User; accessToken: string | null } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken || null;

    if (result.user) {
      await ensureGuideProfile(result.user);
    }
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('Sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const signOutGuide = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

// Guide Profile
export const ensureGuideProfile = async (user: User): Promise<GuideProfile> => {
  const guideRef = doc(db, 'guides', user.uid);
  const profile: GuideProfile = {
    id: user.uid,
    email: user.email || '',
    displayName: user.displayName || user.email?.split('@')[0] || 'Tour Guide',
    photoURL: user.photoURL || undefined,
    role: 'guide',
    updatedAt: new Date().toISOString(),
  };

  try {
    await setDoc(guideRef, profile, { merge: true });
    return profile;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `guides/${user.uid}`);
    return profile;
  }
};

// ----------------- TOURS -----------------

export const subscribeToGuideTours = (
  guideId: string,
  onUpdate: (tours: Tour[]) => void,
  onError?: (err: Error) => void
) => {
  const toursRef = collection(db, 'guides', guideId, 'tours');
  return onSnapshot(
    toursRef,
    (snapshot) => {
      const tours = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Tour));
      // Sort chronologically
      tours.sort((a, b) => a.date.localeCompare(b.date));
      onUpdate(tours);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, `guides/${guideId}/tours`);
      if (onError) onError(error);
    }
  );
};

export const saveGuideTour = async (guideId: string, tour: Tour, previousDate?: string) => {
  const tourRef = doc(db, 'guides', guideId, 'tours', tour.id);
  const newDateRef = doc(db, 'guides', guideId, 'busyDates', tour.date);

  try {
    // 1. If date changed during edit, clean up old date if no other tours exist AND no manual block exists
    if (previousDate && previousDate !== tour.date) {
      const otherToursQuery = query(
        collection(db, 'guides', guideId, 'tours'),
        where('date', '==', previousDate)
      );
      const otherToursSnap = await getDocs(otherToursQuery);
      const remainingTours = otherToursSnap.docs.filter(d => d.id !== tour.id);

      if (remainingTours.length === 0) {
        // Check if there was a manual block on previousDate
        const oldDateDoc = await getDoc(doc(db, 'guides', guideId, 'busyDates', previousDate));
        const oldDateData = oldDateDoc.data() as BusyDateRecord | undefined;
        if (!oldDateData?.isManualBlock) {
          await deleteDoc(doc(db, 'guides', guideId, 'busyDates', previousDate));
        }
      }
    }

    // 2. Save Tour document
    await setDoc(tourRef, tour);

    // 3. Mark the tour date as busy in busyDates
    const existingDateDoc = await getDoc(newDateRef);
    const existingDateData = existingDateDoc.data() as BusyDateRecord | undefined;

    const busyRecord: BusyDateRecord = {
      id: tour.date,
      guideId,
      date: tour.date,
      isBusy: true,
      isManualBlock: Boolean(existingDateData?.isManualBlock), // Preserve manual block flag if it was also manually blocked
      reason: `${tour.destination} (${tour.clientName})`,
      tourId: tour.id,
      updatedAt: new Date().toISOString()
    };
    await setDoc(newDateRef, busyRecord, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `guides/${guideId}/tours/${tour.id}`);
  }
};

export const deleteGuideTour = async (guideId: string, tour: Tour) => {
  const tourRef = doc(db, 'guides', guideId, 'tours', tour.id);
  const dateRef = doc(db, 'guides', guideId, 'busyDates', tour.date);

  try {
    // 1. Delete tour document
    await deleteDoc(tourRef);

    // 2. Check if there are other confirmed tours on this same date
    const sameDateToursQuery = query(
      collection(db, 'guides', guideId, 'tours'),
      where('date', '==', tour.date)
    );
    const sameDateSnap = await getDocs(sameDateToursQuery);
    const remaining = sameDateSnap.docs.filter(d => d.id !== tour.id);

    // Check if the date had a manual block
    const dateDocSnap = await getDoc(dateRef);
    const dateData = dateDocSnap.data() as BusyDateRecord | undefined;

    if (remaining.length > 0) {
      // Still has other tours on this day: update busy record with first remaining tour
      const nextTour = remaining[0].data() as Tour;
      await setDoc(dateRef, {
        id: tour.date,
        guideId,
        date: tour.date,
        isBusy: true,
        reason: `${nextTour.destination} (${nextTour.clientName})`,
        tourId: nextTour.id,
        isManualBlock: Boolean(dateData?.isManualBlock),
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } else if (dateData?.isManualBlock) {
      // No remaining tours, BUT date was manually blocked by the guide:
      // PRESERVE the manual block! Do not delete the busy date record!
      await setDoc(dateRef, {
        id: tour.date,
        guideId,
        date: tour.date,
        isBusy: true,
        isManualBlock: true,
        reason: dateData.reason || 'Manually Blocked Date',
        tourId: null,
        updatedAt: new Date().toISOString()
      });
    } else {
      // No other tours and no manual block: make the date available
      await deleteDoc(dateRef);
    }

    // 3. If tour was linked to an order, update order status to 'accepted_externally' and clear calendarTourId
    if (tour.orderId) {
      const orderRef = doc(db, 'guides', guideId, 'orders', tour.orderId);
      await updateDoc(orderRef, {
        status: 'accepted_externally',
        calendarTourId: null,
        updatedAt: new Date().toISOString()
      }).catch(() => {});
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `guides/${guideId}/tours/${tour.id}`);
  }
};

// ----------------- ORDERS -----------------

export const subscribeToGuideOrders = (
  guideId: string,
  onUpdate: (orders: Order[]) => void,
  onError?: (err: Error) => void
) => {
  const ordersRef = collection(db, 'guides', guideId, 'orders');
  return onSnapshot(
    ordersRef,
    (snapshot) => {
      const orders = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Order));
      // Sort newest received first
      orders.sort((a, b) => new Date(b.receivedAt || b.createdAt).getTime() - new Date(a.receivedAt || a.createdAt).getTime());
      onUpdate(orders);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, `guides/${guideId}/orders`);
      if (onError) onError(error);
    }
  );
};

export const saveGuideOrder = async (guideId: string, order: Order) => {
  const orderRef = doc(db, 'guides', guideId, 'orders', order.id);
  try {
    await setDoc(orderRef, order, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `guides/${guideId}/orders/${order.id}`);
  }
};

export const updateOrderStatus = async (
  guideId: string, 
  orderId: string, 
  status: OrderStatus, 
  calendarTourId?: string
) => {
  const orderRef = doc(db, 'guides', guideId, 'orders', orderId);
  try {
    const updateData: Partial<Order> = {
      status,
      updatedAt: new Date().toISOString()
    };
    if (calendarTourId !== undefined) {
      updateData.calendarTourId = calendarTourId;
    }
    await updateDoc(orderRef, updateData);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `guides/${guideId}/orders/${orderId}`);
  }
};

export const deleteGuideOrder = async (guideId: string, orderId: string) => {
  const orderRef = doc(db, 'guides', guideId, 'orders', orderId);
  try {
    await deleteDoc(orderRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `guides/${guideId}/orders/${orderId}`);
  }
};

// Check if an emailMessageId already exists in Firestore
export const checkOrderExistsByMessageId = async (guideId: string, messageId: string): Promise<boolean> => {
  try {
    const q = query(
      collection(db, 'guides', guideId, 'orders'),
      where('emailMessageId', '==', messageId)
    );
    const snap = await getDocs(q);
    return !snap.empty;
  } catch (error) {
    console.warn('Error checking existing message ID:', error);
    return false;
  }
};

// ----------------- BUSY & BLOCKED DATES -----------------

export const subscribeToGuideBusyDates = (
  guideId: string,
  onUpdate: (dates: BusyDateMap) => void,
  onError?: (err: Error) => void
) => {
  const busyDatesRef = collection(db, 'guides', guideId, 'busyDates');
  return onSnapshot(
    busyDatesRef,
    (snapshot) => {
      const dateMap: BusyDateMap = {};
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data() as BusyDateRecord;
        if (data && data.isBusy) {
          dateMap[docSnap.id] = data;
        }
      });
      onUpdate(dateMap);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, `guides/${guideId}/busyDates`);
      if (onError) onError(error);
    }
  );
};

// Block a single date manually
export const blockGuideDate = async (guideId: string, dateStr: string, reason?: string) => {
  const dateRef = doc(db, 'guides', guideId, 'busyDates', dateStr);
  try {
    const newRecord: BusyDateRecord = {
      id: dateStr,
      guideId,
      date: dateStr,
      isBusy: true,
      isManualBlock: true,
      reason: reason || 'Manually Blocked Date',
      updatedAt: new Date().toISOString(),
    };
    await setDoc(dateRef, newRecord, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `guides/${guideId}/busyDates/${dateStr}`);
  }
};

// Unblock a manually blocked date
export const unblockGuideDate = async (guideId: string, dateStr: string) => {
  // Guard: if there are confirmed tours, never remove the busy state!
  const toursQuery = query(
    collection(db, 'guides', guideId, 'tours'),
    where('date', '==', dateStr)
  );
  const toursSnap = await getDocs(toursQuery);
  if (!toursSnap.empty) {
    throw new Error('This date has confirmed tours scheduled. To free this date, please edit or cancel the scheduled tour first.');
  }

  const dateRef = doc(db, 'guides', guideId, 'busyDates', dateStr);
  try {
    await deleteDoc(dateRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `guides/${guideId}/busyDates/${dateStr}`);
  }
};

// Helper to generate array of ISO dates between start and end (inclusive)
export function getDatesInRange(startDateStr: string, endDateStr: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return [startDateStr];
  }

  const current = new Date(start);
  while (current <= end) {
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, '0');
    const d = String(current.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

// Block a date range in batch
export const blockGuideDateRange = async (
  guideId: string,
  startDate: string,
  endDate: string,
  reason: string
): Promise<number> => {
  const dates = getDatesInRange(startDate, endDate);
  if (dates.length === 0) return 0;

  try {
    const batch = writeBatch(db);
    for (const d of dates) {
      const dateRef = doc(db, 'guides', guideId, 'busyDates', d);
      const record: BusyDateRecord = {
        id: d,
        guideId,
        date: d,
        isBusy: true,
        isManualBlock: true,
        reason: reason || 'Manually Blocked Period',
        updatedAt: new Date().toISOString()
      };
      batch.set(dateRef, record, { merge: true });
    }
    await batch.commit();
    return dates.length;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `guides/${guideId}/busyDates/batch`);
    return 0;
  }
};

// Unblock a date range in batch (skips any dates that have confirmed tours)
export const unblockGuideDateRange = async (
  guideId: string,
  startDate: string,
  endDate: string
): Promise<{ unblockedCount: number; protectedTourDates: string[] }> => {
  const dates = getDatesInRange(startDate, endDate);
  if (dates.length === 0) return { unblockedCount: 0, protectedTourDates: [] };

  try {
    // Find all tours in the user's collection to check protected dates
    const toursQuery = query(collection(db, 'guides', guideId, 'tours'));
    const toursSnap = await getDocs(toursQuery);
    const tourDatesSet = new Set<string>();
    toursSnap.docs.forEach(docSnap => {
      const t = docSnap.data() as Tour;
      if (t.date) tourDatesSet.add(t.date);
    });

    const batch = writeBatch(db);
    let unblockedCount = 0;
    const protectedTourDates: string[] = [];

    for (const d of dates) {
      if (tourDatesSet.has(d)) {
        protectedTourDates.push(d);
      } else {
        const dateRef = doc(db, 'guides', guideId, 'busyDates', d);
        batch.delete(dateRef);
        unblockedCount++;
      }
    }

    if (unblockedCount > 0) {
      await batch.commit();
    }

    return { unblockedCount, protectedTourDates };
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `guides/${guideId}/busyDates/batch`);
    return { unblockedCount: 0, protectedTourDates: [] };
  }
};
